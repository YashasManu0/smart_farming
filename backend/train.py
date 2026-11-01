import os
import json
import tensorflow as tf
from tensorflow.keras import layers, models

# ------------------------------------------------------------------------------
# 1. Configuration & Hyperparameters
# ------------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Check for plantvillage dataset in project root or relative to backend
ROOT_DATASET = os.path.abspath(os.path.join(BASE_DIR, "..", "plantvillage dataset", "color"))
LOCAL_DATASET = os.path.abspath(os.path.join(BASE_DIR, "plantvillage dataset", "color"))
DATA_DIR = ROOT_DATASET if os.path.exists(ROOT_DATASET) else LOCAL_DATASET

IMAGE_SIZE = (224, 224)
BATCH_SIZE = 32
EPOCHS = 10
MODEL_SAVE_PATH = os.path.join(BASE_DIR, "plant_disease_mobilenetv3.h5")
CLASSES_SAVE_PATH = os.path.join(BASE_DIR, "class_names.json")


def main():
    # --------------------------------------------------------------------------
    # 2. Load Dataset (80% Train, 20% Validation)
    # --------------------------------------------------------------------------
    print(f"Loading images from: {DATA_DIR}")
    train_ds = tf.keras.utils.image_dataset_from_directory(
        DATA_DIR,
        validation_split=0.2,
        subset="training",
        seed=123,
        image_size=IMAGE_SIZE,
        batch_size=BATCH_SIZE
    )

    val_ds = tf.keras.utils.image_dataset_from_directory(
        DATA_DIR,
        validation_split=0.2,
        subset="validation",
        seed=123,
        image_size=IMAGE_SIZE,
        batch_size=BATCH_SIZE
    )

    # Save class names for prediction scripts
    class_names = train_ds.class_names
    with open(CLASSES_SAVE_PATH, "w") as f:
        json.dump(class_names, f, indent=4)
    print(f"Found {len(class_names)} classes. Saved names to '{CLASSES_SAVE_PATH}'.")

    # Autotune for fast CPU/GPU loading
    train_ds = train_ds.prefetch(buffer_size=tf.data.AUTOTUNE)
    val_ds = val_ds.prefetch(buffer_size=tf.data.AUTOTUNE)

    # --------------------------------------------------------------------------
    # 3. Build Model with MobileNetV3 (Transfer Learning)
    # --------------------------------------------------------------------------
    print("Building MobileNetV3 transfer learning model...")
    base_model = tf.keras.applications.MobileNetV3Small(
        input_shape=(224, 224, 3),
        include_top=False,
        weights="imagenet"
    )
    base_model.trainable = False  # Freeze pretrained weights

    inputs = layers.Input(shape=(224, 224, 3))
    x = layers.RandomFlip("horizontal_and_vertical")(inputs)
    x = base_model(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.2)(x)
    outputs = layers.Dense(len(class_names), activation="softmax")(x)

    model = models.Model(inputs, outputs)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.0005),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"]
    )

    # --------------------------------------------------------------------------
    # 4. Train and Save Model
    # --------------------------------------------------------------------------
    print(f"Starting training for {EPOCHS} epochs...")
    model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS)

    model.save(MODEL_SAVE_PATH)
    print(f"\nTraining complete! Saved trained model to '{MODEL_SAVE_PATH}'.")


if __name__ == "__main__":
    main()
