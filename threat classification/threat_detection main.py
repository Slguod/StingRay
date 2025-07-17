import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler, PolynomialFeatures
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier # Import XGBClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from imblearn.under_sampling import RandomUnderSampler
from sklearn.feature_selection import SelectKBest, f_classif
import joblib

# --- Start of the complete data processing and model training script ---

print("Starting full data processing and model training pipeline...")

# Load your combined data
try:
    df = pd.read_csv('MachineLearningCVE/combined_data.csv')
    print("Combined dataset loaded successfully.")
except FileNotFoundError:
    print("Error: 'MachineLearningCVE/combined_data.csv' not found. Please ensure the file path is correct.")
    exit()
except Exception as e:
    print(f"An error occurred while loading the CSV: {e}")
    exit()

# Clean column names by stripping whitespace
df.columns = df.columns.str.strip()
print("\nDataFrame columns after stripping whitespace:")
print(df.columns.tolist())

# Handle null values
print("\nChecking for initial null values:")
print(df.isnull().sum().sum()) # Total count of nulls across all columns

# Drop rows with any null values
initial_rows_df = len(df)
df.dropna(inplace=True)
rows_after_dropna_df = len(df)
print(f"Dropped {initial_rows_df - rows_after_dropna_df} rows with null values. Remaining rows: {rows_after_dropna_df}")


# Identify categorical columns for encoding
categorical_cols = df.select_dtypes(include='object').columns.tolist()
print(f"\nIdentified categorical columns for encoding: {categorical_cols}")

# Initialize a variable to store the LabelEncoder for the 'Label' column
label_encoder_for_original_target = None

# Label encode categorical columns and store the encoder for the target
for col in categorical_cols:
    le = LabelEncoder()
    if col == 'Label':
        df[col + '_encoded'] = le.fit_transform(df[col])
        label_encoder_for_original_target = le
    else:
        # Encode other categorical columns (if any, though 'Label' is typically the only object column here)
        df[col + '_encoded'] = le.fit_transform(df[col])
    
    print(f"\nMapping for column '{col}':")
    for label, numerical_value in zip(le.classes_, le.transform(le.classes_)):
        print(f"  '{label}': {numerical_value}")

print("\nDataFrame after initial label encoding categorical columns (head):")
print(df.head())

# Define X and y using the encoded Label
if 'Label_encoded' in df.columns:
    X_initial = df.drop('Label_encoded', axis=1)
    y_initial = df['Label_encoded']
    print("\n'Label_encoded' column found. X_initial and y_initial defined.")
else:
    print("Error: 'Label_encoded' column not found after processing. Please check your label encoding step.")
    exit()

# Filter out only numerical columns from X_initial for feature engineering and scaling
numerical_cols_for_processing = X_initial.select_dtypes(include=np.number).columns
X_numerical_processed = X_initial[numerical_cols_for_processing]
print(f"\nNumerical columns selected for processing: {numerical_cols_for_processing.tolist()}")

# Handle infinite values in numerical features
print("\nChecking for infinite values in numerical features...")
initial_rows_numerical = len(X_numerical_processed)
X_numerical_processed.replace([np.inf, -np.inf], np.nan, inplace=True)
X_numerical_processed.dropna(inplace=True)
rows_dropped_due_to_inf_or_nan_numerical = initial_rows_numerical - len(X_numerical_processed)
if rows_dropped_due_to_inf_or_nan_numerical > 0:
    print(f"Dropped {rows_dropped_due_to_inf_or_nan_numerical} rows due to infinite or NaN values in numerical features.")
else:
    print("No infinite or NaN values found that required dropping rows in numerical features.")

# Align y_initial with the cleaned X_numerical_processed
y_initial = y_initial.loc[X_numerical_processed.index]
print(f"Shape of X_numerical_processed after cleaning: {X_numerical_processed.shape}, y_initial shape: {y_initial.shape}")

# Convert to float32 to reduce memory footprint
X_numerical_processed = X_numerical_processed.astype(np.float32)
print(f"Data type of X_numerical_processed after conversion: {X_numerical_processed.dtypes.iloc[0]}")

# --- FEATURE ENGINEERING ---
print("\n--- Performing Feature Engineering ---")

# 1. Ratio Features
epsilon = 1e-6 # Small constant to avoid division by zero

# Packet Lengths Ratios
X_numerical_processed['fwd_bwd_pkt_len_ratio'] = X_numerical_processed['Fwd Packet Length Mean'] / (X_numerical_processed['Bwd Packet Length Mean'] + epsilon)
X_numerical_processed['pkt_len_max_min_ratio'] = X_numerical_processed['Max Packet Length'] / (X_numerical_processed['Min Packet Length'] + epsilon)

# Flow Rates Ratios
X_numerical_processed['bytes_per_packet'] = X_numerical_processed['Flow Bytes/s'] / (X_numerical_processed['Flow Packets/s'] + epsilon)
X_numerical_processed['fwd_pkt_per_bwd_pkt'] = X_numerical_processed['Total Fwd Packets'] / (X_numerical_processed['Total Backward Packets'] + epsilon)
X_numerical_processed['fwd_bytes_per_bwd_bytes'] = X_numerical_processed['Total Length of Fwd Packets'] / (X_numerical_processed['Total Length of Bwd Packets'] + epsilon)

# Header Length Ratios
X_numerical_processed['fwd_header_len_ratio'] = X_numerical_processed['Fwd Header Length'] / (X_numerical_processed['Bwd Header Length'] + epsilon)


# 2. Polynomial Features on a subset of key features
poly_features_subset = [
    'Flow Duration',
    'Total Fwd Packets',
    'Total Backward Packets',
    'Flow Bytes/s',
    'Flow Packets/s',
    'Fwd Packet Length Mean',
    'Bwd Packet Length Mean',
    'Min Packet Length',
    'Max Packet Length'
]

existing_poly_features = [col for col in poly_features_subset if col in X_numerical_processed.columns]
if len(existing_poly_features) < len(poly_features_subset):
    print(f"Warning: Some intended polynomial features are missing from the dataframe: {list(set(poly_features_subset) - set(existing_poly_features))}")

if existing_poly_features:
    poly = PolynomialFeatures(degree=2, include_bias=False)
    X_poly_transformed = poly.fit_transform(X_numerical_processed[existing_poly_features])
    poly_feature_names = poly.get_feature_names_out(existing_poly_features)
    
    df_poly = pd.DataFrame(X_poly_transformed, columns=poly_feature_names, index=X_numerical_processed.index)
    X_engineered = pd.concat([X_numerical_processed, df_poly], axis=1)
    print(f"Added {len(poly_feature_names)} polynomial features.")
else:
    X_engineered = X_numerical_processed.copy() # If no poly features added, just copy
    print("No existing features found for polynomial transformation.")


print("\n--- DataFrame after Feature Engineering ---")
print("First 5 rows with new features:")
print(X_engineered.head())
print("\nDataFrame Info after Feature Engineering:")
X_engineered.info()

# --- Filter out the 3 classes with the lowest entries ---
print("\nChecking class distribution before filtering lowest-entry categories:")
initial_class_counts_y = y_initial.value_counts()
print(initial_class_counts_y)

# Get the labels of the 3 classes with the lowest counts
classes_to_remove = initial_class_counts_y.nsmallest(3).index.tolist()

print(f"\nIdentified 3 classes to remove (lowest entries, encoded labels): {classes_to_remove}")

# Filter X_engineered and y_initial
mask_filtered_classes = ~y_initial.isin(classes_to_remove)
X_filtered = X_engineered[mask_filtered_classes]
y_filtered = y_initial[mask_filtered_classes]

print(f"\nFiltered out the {len(classes_to_remove)} classes with the lowest entries.")
print("New class distribution after filtering:")
print(y_filtered.value_counts())
print(f"Number of samples before filtering: {len(y_initial)}")
print(f"Number of samples after filtering: {len(y_filtered)}")

# Re-encode y_filtered to ensure contiguous labels (0 to N-1) for model training
print("\nRe-encoding filtered target labels to ensure they are contiguous...")
re_encoder_for_filtered_target = LabelEncoder()
y_final = re_encoder_for_filtered_target.fit_transform(y_filtered)
y_final = pd.Series(y_final, index=y_filtered.index) # Convert back to Series with original index

# Update final_target_names_for_report to reflect the new contiguous mapping
final_target_names_for_report = None
if label_encoder_for_original_target is not None:
    final_target_names_for_report = label_encoder_for_original_target.inverse_transform(re_encoder_for_filtered_target.classes_)
    print(f"\nOriginal names of classes kept and re-mapped for reporting: {final_target_names_for_report.tolist()}")
else:
    print("\nCould not retrieve original classification names for final report. Original label encoder not available.")

print("\nData preprocessing and feature engineering complete. 'X_filtered' and 'y_final' are ready for model training.")
print(f"Final X shape: {X_filtered.shape}, Final y shape: {y_final.shape}")

# --- End of complete data processing script (Part 1: Preprocessing & FE) ---


# --- Model Training and Evaluation Steps (Part 2) ---

# 1. Scaling (using StandardScaler on X_filtered)
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X_filtered)
print("\nFeatures scaled successfully.")
print("Shape of scaled features (X_scaled):", X_scaled.shape)
print("Shape of target variable (y_final) after scaling alignment:", y_final.shape)


# 2. Feature Selection (SelectKBest)
print(f"\nOriginal number of features after scaling: {X_scaled.shape[1]}")
selector = SelectKBest(f_classif, k=70) # Selecting top 70 features. Adjust as needed.
X_selected = selector.fit_transform(X_scaled, y_final)
print(f"Number of features after SelectKBest: {X_selected.shape[1]}")


# 3. Data Splitting (Train, Test)
X_train, X_test, y_train, y_test = train_test_split(
    X_selected, y_final, test_size=0.2, random_state=42, stratify=y_final
)
print(f"\nData split into training and testing sets:")
print(f"X_train shape: {X_train.shape}, y_train shape: {y_train.shape}")
print(f"X_test shape: {X_test.shape}, y_test shape: {y_test.shape}")

# 4. Apply RandomUnderSampler to the training data ONLY
print("\nApplying RandomUnderSampler to the training data to handle class imbalance...")
train_class_distribution = pd.Series(y_train).value_counts()
print(f"Original training set class distribution:\n{train_class_distribution}")

rus = RandomUnderSampler(random_state=42, sampling_strategy='not majority')
X_train_resampled, y_train_resampled = rus.fit_resample(X_train, y_train)

print(f"Original training set samples: {len(X_train)}")
print(f"Resampled training set samples (after RandomUnderSampler): {len(X_train_resampled)}")
print(f"Resampled training set class distribution (after RandomUnderSampler):\n{pd.Series(y_train_resampled).value_counts()}")


# 5. Model Training (Directly using XGBoost)
print("\nStarting XGBoost model training...")

# Define the XGBoost classifier with some common parameters
xgb_classifier = XGBClassifier(
    objective='multi:softmax',
    eval_metric='mlogloss',
    use_label_encoder=False,
    n_estimators=150,      # Number of boosting rounds
    learning_rate=0.1,
    max_depth=6,           # Maximum depth of a tree
    subsample=0.8,
    colsample_bytree=0.8,
    gamma=0.1,             # Minimum loss reduction required to make a further partition
    random_state=42,
    n_jobs=-1
)

# Fit the XGBoost model to the RESAMPLED training data
xgb_classifier.fit(X_train_resampled, y_train_resampled)

print("\nXGBoost model training complete.")

# Get the best model (it's just the fitted xgb_classifier now)
best_xgb_model = xgb_classifier

# 6. Model Evaluation on the Test Set
print("\nEvaluating the model on the test set...")
y_pred = best_xgb_model.predict(X_test)

# Print evaluation metrics
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=final_target_names_for_report if final_target_names_for_report is not None else None))

print("\nConfusion Matrix:")
cm = confusion_matrix(y_test, y_pred)
if final_target_names_for_report is not None:
    cm_df = pd.DataFrame(cm, index=final_target_names_for_report, columns=final_target_names_for_report)
    print(cm_df)
else:
    print(cm)

print(f"\nOverall Accuracy on Test Set: {accuracy_score(y_test, y_pred):.4f}")

# 7. Model Persistence (Saving the trained model and scaler)
print("\nSaving the trained model and associated components...")
joblib.dump(best_xgb_model, 'best_xgboost_model_with_fe.pkl')
joblib.dump(scaler, 'scaler.pkl')
joblib.dump(selector, 'feature_selector.pkl')
joblib.dump(label_encoder_for_original_target, 'label_encoder_original.pkl')
joblib.dump(re_encoder_for_filtered_target, 'label_encoder_filtered.pkl')
print("XGBoost model, scaler, feature selector, and label encoders saved successfully.")

# --- End of Model Training and Evaluation Steps ---