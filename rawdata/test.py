import glob
import os
import json
import pandas as pd
import re
from datetime import datetime

def parse_winner_count(file_path):
    """
    Parses the winner.count file and returns a dictionary of contests with their 'pick' values.
    Format of the dictionary:
    {
        (year, contest_name): pick_value
    }
    """
    winners_dict = {}
    current_year = None

    with open(file_path, "r") as f:
        for line in f:
            line = line.strip()

            # If the line starts with "year XXXX", update the current year
            if line.startswith("year "):
                current_year = line.split(" ")[1]
                continue

            # Otherwise, parse the contest name and "vote for X"
            match = re.match(r"^(.*) \(VOTE FOR (\d+)\)$", line)
            if match:
                contest_name = match.group(1)
                pick_value = int(match.group(2))

                # Store the contest name and pick value in the dictionary
                if current_year is not None:
                    winners_dict[(current_year, contest_name)] = pick_value

    return winners_dict

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
        tags.append("ref")
    elif "REFERENDUM" in title_upper:
        tags.append("ref")

    return tags

def mutate_contest_title(title: str) -> str:
    """
    Mutate contest titles for brevity by:
      - Dropping specific substrings
      - Substituting certain words
      - Removing leading zeros from numbers
      - Converting to title case
      - Adjusting capitalization of "of " and "and "
      - Preserving "US " and "NC " in uppercase
    """
    # Define substrings to remove
    remove_phrases = [
        "CITY OF ",
        "TOWN OF ",
        "IMPROVEMENTS ",
        "OF REPRESENTATIVES ",
        " REFERENDUM",
        " CONSERVATION DISTRICT SUPERVISOR",
        " CONSERVATION DIST SUPERVISOR"
    ]
    # Do not drop "DISTRICT " if it is part of specific phrases
    if "DISTRICT ATTORNEY" not in title.upper() and "DISTRICT COURT" not in title.upper() and "DISTRICT SUPERVISOR" not in title.upper():
        remove_phrases.append("DISTRICT ")

    # Define substitutions
    substitutions = {
        "Parks, Greenways, Recreation, And Open Space": "Parks and Rec",
        "Recreation ": "Rec ",
        "Recreational ": "Rec ",
        " Bonds": " Bond",
        "Wake Co. ": "Wake County ",
        "Wake Co ": "Wake County ",
        "Soil Water": "Soil and Water"
    }

    # Remove specific phrases
    for phrase in remove_phrases:
        title = title.replace(phrase, "")

    # Convert to title case
    title = title.title()

    # Apply substitutions
    for old, new in substitutions.items():
        title = title.replace(old, new)
        
    # Remove leading zeros from numbers using regex
    title = re.sub(r'\b0+(\d+)', r'\1', title)

    # Adjust "Of " and "And " to lowercase
    title = title.replace("Of ", "of ").replace("And ", "and ")

    # Restore "US " and "NC " as uppercase after title casing
    title = title.replace("Us ", "US ").replace("Nc ", "NC ")

    # Remove all commas
    title = title.replace(",", "")

    return title

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
    # Parse the winner.count file to get the number of winners for contests
    winners_dict = parse_winner_count("winner.count")

    # Process each .txt file in the current directory
    for filepath in glob.glob("*.txt"):
        filename_no_ext = os.path.splitext(filepath)[0]
        output_json_name = f"{filename_no_ext}.json"

        contests_info = []  # Will hold metadata for all contests in this file

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

        # 3. Remove commas from candidate names
        df["candidate_name"] = df["candidate_name"].str.replace(",", "", regex=False)        

        # 4. Replace UNDER/OVER votes (with or without 'S') with 'under' and 'over'
        df.loc[df["candidate_name"].str.upper() == "UNDER VOTE", "candidate_name"] = "under"
        df.loc[df["candidate_name"].str.upper() == "OVER VOTE", "candidate_name"] = "over"
        df.loc[df["candidate_name"].str.upper() == "UNDER VOTES", "candidate_name"] = "under"
        df.loc[df["candidate_name"].str.upper() == "OVER VOTES", "candidate_name"] = "over"

        # 5. Identify all unique contests
        unique_contests = df["contest_title"].unique()

        for contest_title in unique_contests:
            # Skip ignored contests
            if "DURHAM" in contest_title.upper() or "ANGIER" in contest_title.upper():
                continue

            # 5a. Subset the DataFrame for this contest
            sub_df = df[df["contest_title"] == contest_title].copy()

            # 5b. Get tags before mutating the title
            tags = get_tags(contest_title)

            # 5c. Mutate the contest title for brevity and title case
            mutated_title = mutate_contest_title(contest_title)

            # 5d. Determine the year from the election date
            election_year = parse_year_from_election_dt(sub_df["election_dt"])

            # 5e. Get the number of winners (pick) for this contest
            pick_value = winners_dict.get((str(election_year), contest_title), 1)            

            # 6. Build the pivot table: Rows = precinct_code, Columns = candidate_name, Values = sum(vote_ct)
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

            # Write the pivot table to a CSV file
            output_csv_name = f"{filename_no_ext}_{mutated_title.replace(' ', '_')}.csv"
            pivot.to_csv(output_csv_name, index=False)

            # 7. Compute total_votes and candidate summary
            candidate_sums = (
                sub_df
                .groupby("candidate_name", as_index=False)["vote_ct"]
                .sum()
            )
            candidate_sums = candidate_sums[candidate_sums["vote_ct"] != 0].copy()

            # Capture party labels
            party_map = (
                sub_df.groupby("candidate_name", as_index=False)["candidate_party_lbl"]
                .agg(lambda x: x.mode()[0] if not x.mode().empty else "")
            )
            candidate_sums = candidate_sums.merge(party_map, on="candidate_name", how="left")

            valid_candidates = candidate_sums[~candidate_sums["candidate_name"].isin(["over", "under"])]
            valid_total = valid_candidates["vote_ct"].sum()

            candidates_list = []
            for _, row_cand in candidate_sums.iterrows():
                cand_name = row_cand["candidate_name"]
                party_lbl = row_cand["candidate_party_lbl"] if pd.notnull(row_cand["candidate_party_lbl"]) else ""
                votes = int(row_cand["vote_ct"])
                percent = round((votes / valid_total) * 100, 2) if valid_total > 0 else 0

                candidate_info = {
                    "name": cand_name,
                    "political_party": party_lbl,
                    "votes": votes,
                    "total_votes": int(valid_total),
                    "percent": percent,
                    "total": "all"
                }
                candidates_list.append(candidate_info)

            # 7. Build contest info
            contest_info = {
                "name": mutated_title,
                "csv_file": output_csv_name,
                "year": parse_year_from_election_dt(sub_df["election_dt"]),
                "tags": tags,
                "pick": pick_value,  # Add the pick value                
                "candidates": candidates_list
            }

            contests_info.append(contest_info)

        # 8. Write the JSON file for this input file
        with open(output_json_name, "w", encoding="utf-8") as f:
            json.dump({"contests": contests_info}, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
