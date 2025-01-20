import csv
import json
import os
import argparse

def update_json(csv_file, json_file, output_file):
    # Parse CSV file and calculate column sums
    column_sums = {}
    with open(csv_file, 'r') as csv_f:
        reader = csv.DictReader(csv_f)
        for row in reader:
            for column, value in row.items():
                try:
                    column_sums[column] = column_sums.get(column, 0) + int(value)
                except ValueError:
                    pass  # Ignore non-numeric values

    # Load JSON file
    with open(json_file, 'r') as json_f:
        data = json.load(json_f)

    # Update JSON data
    csv_filename = os.path.basename(csv_file)
    year = int(''.join(filter(str.isdigit, csv_filename))[-4:])  # Extract year from filename

    for contest in data.get("contests", []):
        contest["csv_file"] = csv_filename
        contest["year"] = year

        for candidate in contest.get("candidates", []):
            column_votes = candidate.get("column")
            column_total = candidate.get("total")

            votes = column_sums.get(column_votes, 0)
            total_votes = column_sums.get(column_total, 0)

            candidate["votes"] = votes
            candidate["total_votes"] = total_votes
            candidate["percent"] = round((votes / total_votes) * 100, 2) if total_votes > 0 else 0.0

    # Write updated JSON to output file
    with open(output_file, 'w') as out_f:
        json.dump(data, out_f, indent=4)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Update JSON summary file based on CSV election results.")
    parser.add_argument("csv_file", help="Path to the input CSV file.")
    parser.add_argument("json_file", help="Path to the input JSON file.")
    parser.add_argument("output_file", help="Path to the output JSON file.")
    args = parser.parse_args()

    update_json(args.csv_file, args.json_file, args.output_file)
    print(f"Updated JSON file written to {args.output_file}")
