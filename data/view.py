import pandas as pd
import tkinter as tk
from tkinter import ttk, filedialog

class Tooltip:
    """Tooltip for Treeview cells."""
    def __init__(self, widget):
        self.widget = widget
        self.tipwindow = None

    def show(self, text, x, y):
        if self.tipwindow or not text:
            return
        self.tipwindow = tw = tk.Toplevel(self.widget)
        tw.wm_overrideredirect(True)
        tw.geometry(f"+{x+10}+{y+10}")  # Offset to position the tooltip
        label = tk.Label(tw, text=text, background="#ffffe0", relief="solid", borderwidth=1)
        label.pack(ipadx=1)

    def hide(self):
        if self.tipwindow:
            self.tipwindow.destroy()
            self.tipwindow = None


def calculate_turnout(input_file):
    """Calculate turnout percentages and add them to the dataframe."""
    data = pd.read_csv(input_file)
    
    # Add turnout percentage columns
    for col in data.columns:
        if "_voted" in col:
            base_col = col.replace("_voted", "")
            turnout_col = f"{base_col}_turnout"
            data[turnout_col] = (data[col] / data[base_col] * 100).fillna(0)
            data[turnout_col] = data[turnout_col].map(lambda x: f"{x:.2f}%" if pd.notnull(x) else "")
    
    return data


def add_summary_row(df):
    """Add a summary row with sums and calculated turnout percentages."""
    summary = {}
    numeric_columns = [col for col in df.columns if df[col].dtype in ['int64', 'float64']]
    percentage_columns = [col for col in df.columns if "_turnout" in col]
    
    for col in df.columns:
        if col in numeric_columns and col not in percentage_columns:
            summary[col] = df[col].sum()
        elif col in percentage_columns:
            base_col = col.replace("_turnout", "")
            if base_col in df.columns and f"{base_col}_voted" in df.columns:
                total = summary.get(base_col, df[base_col].sum())
                voted = summary.get(f"{base_col}_voted", df[f"{base_col}_voted"].sum())
                summary[col] = f"{(voted / total * 100):.2f}%" if total > 0 else "0.00%"
        else:
            summary[col] = "Total"  # Placeholder for non-numeric columns like 'precinct_abbrv'
    
    return pd.concat([df, pd.DataFrame([summary])], ignore_index=True)


def open_file():
    """Open a CSV file and calculate turnout."""
    file_path = filedialog.askopenfilename(filetypes=[("CSV files", "*.csv")])
    if not file_path:
        return

    # Calculate turnout and update the table
    df = calculate_turnout(file_path)
    df_with_summary = add_summary_row(df)
    update_table(df_with_summary)


def update_table(df):
    """Update the table with the selected columns, including the summary row."""
    global current_df, column_visibility, sort_state
    current_df = df

    # Initialize column visibility if not already set
    if not column_visibility:
        for col in current_df.columns:
            column_visibility[col] = tk.BooleanVar(value=(col == "precinct_abbrv"))  # Default: Only "precinct_abbrv"

    # Initialize sort state if not already set
    if not sort_state:
        for col in current_df.columns:
            sort_state[col] = False  # Default: Not sorted (ascending)

    # Get visible columns
    visible_columns = [col for col in current_df.columns if column_visibility[col].get()]

    # Clear the existing table
    for i in table.get_children():
        table.delete(i)

    # Update table columns
    table["columns"] = visible_columns
    for col in visible_columns:
        table.heading(col, text=col, command=lambda _col=col: sort_by_column(_col))

    # Add data to the table
    for idx, row in current_df.iterrows():
        values = [row[col] for col in visible_columns]
        tag = "summary" if idx == len(current_df) - 1 else "normal"
        table.insert("", tk.END, values=values, tags=(tag,))

    # Add styles for the summary row
    table.tag_configure("summary", background="#f0f0f0", font=("Arial", 10, "bold"))

    # Adjust column widths
    for col in visible_columns:
        table.column(col, width=100)

    # Add tooltips for turnout columns
    add_tooltips(df, visible_columns)


def add_tooltips(df, visible_columns):
    """Add tooltips to turnout columns with total and voted values."""
    tooltip_map.clear()
    for i, item_id in enumerate(table.get_children()):
        row = df.iloc[i]
        for col in visible_columns:
            if "_turnout" in col:
                base_col = col.replace("_turnout", "")
                total = row.get(base_col, "")
                voted = row.get(f"{base_col}_voted", "")
                tooltip_text = f"Total: {total}, Voted: {voted}"
                tooltip_map[(item_id, col)] = tooltip_text


def show_tooltip(event):
    """Show tooltip on hover."""
    region = table.identify_region(event.x, event.y)
    if region == "cell":
        item_id = table.identify_row(event.y)
        column = table.identify_column(event.x)
        col_index = int(column[1:]) - 1  # Convert column identifier to index
        if item_id and col_index >= 0:
            col_name = table["columns"][col_index]
            tooltip_text = tooltip_map.get((item_id, col_name), "")
            x, y = event.x_root, event.y_root
            tooltip.show(tooltip_text, x, y)
    else:
        tooltip.hide()


def hide_tooltip(event):
    """Hide tooltip on hover exit."""
    tooltip.hide()


def toggle_columns():
    """Show a column toggle window with scrollable checkboxes."""
    def apply_changes():
        update_table(current_df)
        toggle_window.destroy()

    toggle_window = tk.Toplevel(root)
    toggle_window.title("Select Columns")
    toggle_window.geometry("400x600")

    # Add a scrollable frame
    canvas = tk.Canvas(toggle_window)
    scroll_y = tk.Scrollbar(toggle_window, orient="vertical", command=canvas.yview)
    scrollable_frame = ttk.Frame(canvas)

    scrollable_frame.bind(
        "<Configure>",
        lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
    )
    canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
    canvas.configure(yscrollcommand=scroll_y.set)

    canvas.pack(side="left", fill="both", expand=True)
    scroll_y.pack(side="right", fill="y")

    tk.Label(scrollable_frame, text="Select columns to display:").pack(anchor="w", padx=10, pady=5)

    for col in current_df.columns:
        checkbox = tk.Checkbutton(scrollable_frame, text=col, variable=column_visibility[col])
        checkbox.pack(anchor="w", padx=10)

    tk.Button(scrollable_frame, text="Apply", command=apply_changes).pack(pady=10)


def sort_by_column(column):
    """Sort the table by a given column, excluding the summary row."""
    global current_df, sort_state

    # Toggle sort direction
    descending = sort_state[column]
    sort_state[column] = not descending

    # Exclude the summary row for sorting
    df_no_summary = current_df.iloc[:-1]
    summary_row = current_df.iloc[-1:]

    # Sort the dataframe
    sorted_df = df_no_summary.sort_values(by=column, ascending=not descending)

    # Reattach the summary row
    updated_df = pd.concat([sorted_df, summary_row], ignore_index=True)

    # Refresh the table
    update_table(updated_df)


def save_file():
    """Save the current dataframe to a file."""
    if current_df is None:
        return
    file_path = filedialog.asksaveasfilename(defaultextension=".csv", filetypes=[("CSV files", "*.csv")])
    if file_path:
        current_df.to_csv(file_path, index=False)


# Create the main GUI window
root = tk.Tk()
root.title("Turnout Summary")

# Add a file menu
menu = tk.Menu(root)
root.config(menu=menu)
file_menu = tk.Menu(menu, tearoff=0)
menu.add_cascade(label="File", menu=file_menu)
file_menu.add_command(label="Open", command=open_file)
file_menu.add_command(label="Save As", command=save_file)
file_menu.add_command(label="Select Columns", command=toggle_columns)
file_menu.add_command(label="Exit", command=root.quit)

# Create a table to display the data
frame = ttk.Frame(root)
frame.pack(fill=tk.BOTH, expand=True)

table = ttk.Treeview(frame, show="headings")
table.pack(fill=tk.BOTH, expand=True, side=tk.LEFT)

# Add scrollbars to the table
scroll_y = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=table.yview)
scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
scroll_x = ttk.Scrollbar(root, orient=tk.HORIZONTAL, command=table.xview)
scroll_x.pack(side=tk.BOTTOM, fill=tk.X)
table.configure(yscroll=scroll_y.set, xscroll=scroll_x.set)

# Initialize global dataframe, column visibility, and sort state
current_df = None
column_visibility = {}
sort_state = {}

# Tooltip management
tooltip = Tooltip(table)
tooltip_map = {}

table.bind("<Motion>", show_tooltip)
table.bind("<Leave>", hide_tooltip)

# Run the GUI
root.mainloop()
