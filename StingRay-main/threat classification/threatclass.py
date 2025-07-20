
import pandas as pd

# List of CSV file paths you want to combine
csv_files = [
    'MachineLearningCVE/Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv',
    'MachineLearningCVE/Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv',
    'MachineLearningCVE/Friday-WorkingHours-Morning.pcap_ISCX.csv',
    'MachineLearningCVE/Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv',
    'MachineLearningCVE/Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv',
    'MachineLearningCVE/Wednesday-workingHours.pcap_ISCX.csv',
    'MachineLearningCVE/Tuesday-WorkingHours.pcap_ISCX.csv',
    'MachineLearningCVE/Monday-WorkingHours.pcap_ISCX.csv'
]

# Read and combine them
dfs = [pd.read_csv(file) for file in csv_files]
combined_df = pd.concat(dfs, ignore_index=True)

# Preview the dataset
print(combined_df.head())

# Save combined dataset (optional)
combined_df.to_csv('MachineLearningCVE/combined_data.csv', index=False)