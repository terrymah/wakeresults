import glob
import os
import json
import pandas as pd
from datetime import datetime

def get_tags(contest_title: str) -> list:
    """
    Determine tags (local, state, federal, bond) for a contest_title based on simple rules:
      - If it starts with 'US' -> ['federal']
      - Elif it starts with 'NC' -> ['state']
      - Elif it starts with 'WAKE' -> ['local']
      - Elif it contains 'CITY' or 'TOWN' (case-insensitive) -> ['local']
      - Else -> ['state']
      - If 'BOND' in the title (case-insensitive), also add 'bond'
    """
    tags = []
    title_upper = contest_title.upper()

    if title_upper.startswith("US"):
        tags.append("federal")
    elif title_upper.startswith("NC"):
        tags.append("state")
    elif title_upper.startswith("WAKE"):
        tags.append("local")
    elif "CITY" in title_upper or "TOWN" in title_upper:
        tags.append("local")
    else:
        # Default if none of the above
        tags.append("state")

    # If "BOND" is anywhere in the contest title, add "bond"
    if "BOND" in title_upper:
        tags.append("bond")

    return tags

def parse_year_from_election_dt(election_dt_values: pd.Series) -> int:
    """
    Given a Series of date strings in 'MM/DD/YYYY' format,
    return an integer representing the year of the first non-empty date.
    If none is available or parsing fails, return None.
    """
    for dt_str in election_dt_values:
        if isinstance(dt_str, str) and dt_str.strip():
            try:
                dt = datetime.strptime(dt_str, "%m/%d/%Y")
                return dt.year
            except ValueError:
                pass
    return None

def main():
    contests_info = []  # Will hold metadata for all contests across all files

    # Process each .txt file in the current directory
    for filepath in glob.glob("*.txt"):
        filename_no_ext = os.path.splitext(filepath)[0]

        # 1. Read the tab-delimited CSV (.txt) into a DataFrame
        df = pd.read_csv(filepath, sep="\t", dtype={
            "county_id": str,
            "county": str,
            "election_dt": str,
            "result_type_lbl": str,
            "result_type_desc": str,
            "contest_id": str,
            "contest_title": str,
            "contest_party_lbl": str,
            "contest_vote_for": str,
            "precinct_code": str,
            "precinct_name": str,
            "candidate_id": str,
            "candidate_name": str,
            "candidate_party_lbl": str,
            "group_num": str,
            "group_name": str,
            "voting_method_lbl": str,
            "voting_method_rslt_desc": str,
            "vote_ct": float  # read votes as float (cast to int before writing CSV)
        })

        # 2. Write-in rule: If result_type_lbl == "WRI", rename candidate_name to "Write-In"
        df.loc[df["result_type_lbl"] == "WRI", "candidate_name"] = "Write-In"

        # 3. Identify all unique contests
        unique_contests = df["contest_title"].unique()

        for contest_title in unique_contests:
            # 3a. Subset the DataFrame for this contest
            sub_df = df[df["contest_title"] == contest_title].copy()

            # 3b. Rename OVER/UNDER votes
            sub_df.loc[sub_df["candidate_name"] == "OVER VOTE", "candidate_name"] = "over"
            sub_df.loc[sub_df["candidate_name"] == "UNDER VOTE", "candidate_name"] = "under"
            sub_df.loc[sub_df["candidate_name"] == "OVER VOTES", "candidate_name"] = "over"
            sub_df.loc[sub_df["candidate_name"] == "UNDER VOTES", "candidate_name"] = "under"


            # 4. Build the pivot table: Rows = precinct_code, Columns = candidate_name, Values = sum(vote_ct)
            pivot = (
                sub_df
                .groupby(["precinct_code", "candidate_name"], as_index=False)["vote_ct"]
                .sum()
                .pivot(index="precinct_code", columns="candidate_name", values="vote_ct")
                .fillna(0)
            )

            # --- Drop zero-vote candidates (columns) and zero-vote precincts (rows) ---

            # Reset index so 'precinct_code' becomes a normal "id" column
            pivot.reset_index(inplace=True)
            pivot.rename(columns={"precinct_code": "id"}, inplace=True)

            # Identify candidate columns (everything except 'id')
            candidate_cols = [c for c in pivot.columns if c != "id"]

            # Drop columns (candidates) that sum to 0
            col_sums = pivot[candidate_cols].sum(axis=0)
            non_zero_cols = col_sums[col_sums != 0].index.tolist()
            pivot = pivot[["id"] + non_zero_cols]

            # Drop rows (precincts) that sum to 0 across all remaining columns
            row_sums = pivot[non_zero_cols].sum(axis=1)
            pivot = pivot.loc[row_sums != 0].copy()

            # Cast numeric columns to int
            for col in pivot.columns:
                if col != "id":
                    pivot[col] = pivot[col].astype(int)

            # 5. Construct the output filename and write CSV
            sanitized_contest_title = contest_title.replace(" ", "_")
            output_csv_name = f"{filename_no_ext}_{sanitized_contest_title}.csv"
            pivot.to_csv(output_csv_name, index=False)

            # 6. Build metadata for index.json

            #    a) Summation of vote_ct by candidate_name only
            #       Filter out candidates who have 0 total votes
            candidate_sums = (
                sub_df
                .groupby("candidate_name", as_index=False)["vote_ct"]
                .sum()
            )
            candidate_sums = candidate_sums[candidate_sums["vote_ct"] != 0].copy()

            #    b) Capture each candidate’s party label (if any)
            party_map = (
                sub_df.groupby("candidate_name", as_index=False)["candidate_party_lbl"]
                .agg(lambda x: x.mode()[0] if not x.mode().empty else "")
            )

            #    c) Merge to attach party labels
            candidate_sums = candidate_sums.merge(party_map, on="candidate_name", how="left")

            #    d) Determine the year from election_dt for this contest
            year_value = parse_year_from_election_dt(sub_df["election_dt"])

            #    e) Compute total_votes (sum of valid candidates except 'over' or 'under')
            valid_candidates = candidate_sums[~candidate_sums["candidate_name"].isin(["over", "under"])]
            valid_total = valid_candidates["vote_ct"].sum()

            #    f) Prepare candidate JSON objects
            candidates_list = []
            for _, row_cand in candidate_sums.iterrows():
                cand_name = row_cand["candidate_name"]
                party_lbl = row_cand["candidate_party_lbl"] if pd.notnull(row_cand["candidate_party_lbl"]) else ""
                votes = int(row_cand["vote_ct"])

                # Convert fraction to true percentage x 100
                percent_fraction = votes / valid_total if valid_total > 0 else 0
                percent = round(percent_fraction * 100, 2)  # e.g. 12.34 means 12.34%

                candidate_info = {
                    "name": cand_name,
                    "political_party": party_lbl,
                    "votes": votes,
                    "total_votes": int(valid_total),
                    "percent": percent,
                    "total": "all"
                }
                candidates_list.append(candidate_info)

            #    g) Build the tags (includes 'bond' if "Bond" is in the title)
            tags = get_tags(contest_title)

            #    h) Build the contest info object
            contest_info = {
                "name": contest_title,
                "csv_file": output_csv_name,
                "year": year_value,
                "tags": tags,
                "candidates": candidates_list
            }

            contests_info.append(contest_info)

    # 7. After processing all files, write the global index.json
    with open("index.json", "w", encoding="utf-8") as f:
        json.dump({"contests": contests_info}, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
