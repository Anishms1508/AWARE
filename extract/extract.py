import camelot
import pandas as pd

# Path to your PDF
pdf_path = r"WQuality_River-Data-2023.pdf"

# Extract all tables using lattice mode
tables = camelot.read_pdf(pdf_path, pages="all", flavor="lattice")

print("Total tables found:", tables.n)

# Example: Convert first table into DataFrame
df = tables[0].df
print(df)

# Save each table as CSV
for i, table in enumerate(tables):
    df = table.df
    df.to_csv(f"table_{i}.csv", index=False)
    print(f"Saved table_{i}.csv -> shape={df.shape}")
