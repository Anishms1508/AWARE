# merge_clean.py
import pandas as pd
import glob
import os

def make_unique(cols):
    """Return list of unique column names by appending suffixes to duplicates."""
    seen = {}
    new = []
    for c in cols:
        key = str(c).strip()
        if key == '' or key.lower() == 'nan':
            key = '_blank_'
        if key in seen:
            seen[key] += 1
            new.append(f"{key}__{seen[key]}")
        else:
            seen[key] = 0
            new.append(key)
    return new

def detect_header_index(df):
    """
    Heuristic: locate the first row that contains any of the header keywords.
    Returns header row index or None.
    """
    header_keywords = ['Station', 'Monitoring', 'State', 'Temperature', 'Dissolved', 'Conductivity', 'Fecal', 'Total Coliform', 'BOD', 'pH']
    for i in range(min(6, len(df))):  # inspect first few rows for header
        row_text = " ".join(str(x) for x in df.iloc[i].fillna(''))
        row_text_low = row_text.lower()
        for kw in header_keywords:
            if kw.lower() in row_text_low:
                return i
    return None

def clean_table(df):
    # drop fully empty rows/cols
    df = df.dropna(how='all')
    df = df.dropna(axis=1, how='all')
    if df.shape[0] == 0 or df.shape[1] == 0:
        return None

    # sometimes first row is the numeric header "0,1,2,3..", drop if present
    first_row = df.iloc[0].astype(str).str.cat(sep=' ')
    if first_row.strip().split()[0].isdigit() and ',' in first_row:
        df = df.iloc[1:].reset_index(drop=True)
        if df.shape[0] == 0:
            return None

    # find header row
    header_index = detect_header_index(df)
    if header_index is None:
        # fallback: assume first non-empty row is header
        header_index = 0

    # set header
    new_cols = list(df.iloc[header_index].fillna('').astype(str))
    new_cols = make_unique(new_cols)
    df = df.iloc[header_index+1:].reset_index(drop=True)
    df.columns = new_cols

    # strip whitespace from column names
    df.columns = [c.strip() for c in df.columns]

    # drop wholly empty columns (again)
    df = df.dropna(axis=1, how='all')

    # optional: normalize some column names (shorten)
    replacements = {
        'Temperature (°C) Min': 'Temp_Min', 'Temperature (°C) Max': 'Temp_Max',
        'Dissolved Oxygen (mg/L) Min': 'DO_Min', 'Dissolved Oxygen (mg/L) Max': 'DO_Max',
        'pH Min': 'pH_Min', 'pH Max': 'pH_Max',
        'Conductivity (µmho/cm) Min': 'Cond_Min', 'Conductivity (µmho/cm) Max': 'Cond_Max',
        'BOD (mg/L) Min': 'BOD_Min', 'BOD (mg/L) Max': 'BOD_Max',
        'Fecal Coliform (MPN/100ml) Min': 'Fecal_Min', 'Fecal Coliform (MPN/100ml) Max': 'Fecal_Max',
        'Total Coliform (MPN/100ml) Min': 'TotalCol_Min', 'Total Coliform (MPN/100ml) Max': 'TotalCol_Max'
    }
    # apply simple replacements where exact matches found
    df.rename(columns={k:v for k,v in replacements.items() if k in df.columns}, inplace=True)

    return df

def main():
    csv_files = sorted(glob.glob("table_*.csv"))
    if not csv_files:
        print("No table_*.csv files found in cwd:", os.getcwd())
        return

    cleaned_tables = []
    for file in csv_files:
        try:
            df = pd.read_csv(file, header=None, dtype=str, keep_default_na=False)
        except Exception as e:
            print("Skipping", file, "— read error:", e)
            continue

        cleaned = clean_table(df)
        if cleaned is None or cleaned.shape[0] == 0:
            print("Skipping empty/invalid table:", file)
            continue

        # add source table name so we can trace rows later
        cleaned.insert(0, "_source_file", os.path.basename(file))
        cleaned_tables.append(cleaned)

    if not cleaned_tables:
        print("No valid tables after cleaning.")
        return

    # concat with ignore_index=True and sort=False (columns will be unioned automatically)
    merged = pd.concat(cleaned_tables, ignore_index=True, sort=False)

    # drop columns that are entirely blanks
    merged = merged.loc[:, merged.columns.to_series().apply(lambda c: merged[c].replace('', pd.NA).notna().any())]

    # Save cleaned dataset
    out_name = "WQ_combined_clean.csv"
    merged.to_csv(out_name, index=False)
    print("Saved cleaned file", out_name, "shape:", merged.shape)

if __name__ == "__main__":
    main()
