import csv
import argparse
from collections import defaultdict

def load_voters_who_voted(voting_file, election_label):
    """Load voter_reg_num for voters who voted in the specified election."""
    voted_voters = set()
    with open(voting_file, 'r', encoding='utf-8', errors='replace') as file:
        reader = csv.DictReader(file, delimiter="\t")
        for row in reader:
            if row['election_lbl'] == election_label:
                voted_voters.add(row['voter_reg_num'])
    return voted_voters

def process_voter_file(voter_file, voting_file, output_file, election_label):
    # Load voters who voted in the specified election
    voted_voters = load_voters_who_voted(voting_file, election_label)

    # Dictionaries for aggregation
    precinct_data = defaultdict(lambda: defaultdict(int))
    gender_codes = set()
    race_codes = set()
    ethnic_codes = set()
    party_codes = set()

    # Process the voter file
    with open(voter_file, 'r', encoding='utf-8', errors='replace') as file:
        reader = csv.DictReader(file, delimiter="\t")
        
        for row in reader:
            if row['status_cd'] != 'A':
                continue
            
            precinct = row['precinct_abbrv']
            voter_reg_num = row['voter_reg_num']
            precinct_data[precinct]['total'] += 1
            if voter_reg_num in voted_voters:
                precinct_data[precinct]['voted_total'] += 1

            # Demographic fields
            demographics = {
                'gender': (row['gender_code'], gender_codes),
                'race': (row['race_code'], race_codes),
                'ethnic': (row['ethnic_code'], ethnic_codes),
                'party': (row['party_cd'], party_codes),
            }
            
            for prefix, (code, code_set) in demographics.items():
                if code:
                    key = f"{prefix}_{code}"
                    precinct_data[precinct][key] += 1
                    code_set.add(code)
                    if voter_reg_num in voted_voters:
                        precinct_data[precinct][f"{key}_voted"] += 1
    
    # Write aggregated data to a CSV file
    with open(output_file, 'w', encoding='utf-8', newline='') as file:
        writer = csv.writer(file)
        
        # Define headers
        headers = ['precinct_abbrv', 'total', 'voted_total']
        headers += [f"gender_{code}" for code in sorted(gender_codes)]
        headers += [f"gender_{code}_voted" for code in sorted(gender_codes)]
        headers += [f"race_{code}" for code in sorted(race_codes)]
        headers += [f"race_{code}_voted" for code in sorted(race_codes)]
        headers += [f"ethnic_{code}" for code in sorted(ethnic_codes)]
        headers += [f"ethnic_{code}_voted" for code in sorted(ethnic_codes)]
        headers += [f"party_{code}" for code in sorted(party_codes)]
        headers += [f"party_{code}_voted" for code in sorted(party_codes)]
        writer.writerow(headers)
        
        # Write rows for each precinct
        for precinct, data in precinct_data.items():
            row = [precinct, data['total'], data.get('voted_total', 0)]
            row += [data.get(f"gender_{code}", 0) for code in sorted(gender_codes)]
            row += [data.get(f"gender_{code}_voted", 0) for code in sorted(gender_codes)]
            row += [data.get(f"race_{code}", 0) for code in sorted(race_codes)]
            row += [data.get(f"race_{code}_voted", 0) for code in sorted(race_codes)]
            row += [data.get(f"ethnic_{code}", 0) for code in sorted(ethnic_codes)]
            row += [data.get(f"ethnic_{code}_voted", 0) for code in sorted(ethnic_codes)]
            row += [data.get(f"party_{code}", 0) for code in sorted(party_codes)]
            row += [data.get(f"party_{code}_voted", 0) for code in sorted(party_codes)]
            writer.writerow(row)
    
    print(f"Summary written to {output_file}")

def main():
    parser = argparse.ArgumentParser(description="Process a voter file and generate a precinct summary with voting data.")
    parser.add_argument("voter_file", help="Path to the input TSV voter file")
    parser.add_argument("voting_file", help="Path to the input TSV voting file")
    parser.add_argument("output_file", help="Path to the output CSV summary file")
    parser.add_argument("--election", default="11/05/2024", help="Election label to filter voting data (default: 11/05/2024)")
    args = parser.parse_args()
    
    process_voter_file(args.voter_file, args.voting_file, args.output_file, args.election)

if __name__ == "__main__":
    main()
