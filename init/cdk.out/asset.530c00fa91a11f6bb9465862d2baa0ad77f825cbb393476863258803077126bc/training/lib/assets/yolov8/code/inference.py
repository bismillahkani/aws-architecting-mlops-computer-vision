import numpy as np
from PIL import Image
import torch, os, json, io, cv2, time, base64
from ultralytics import YOLO

def model_fn(model_dir):
    print("Executing model_fn from inference.py ...")
    env = os.environ
    model = YOLO("/opt/ml/model/code/" + env['YOLOV8_MODEL'], task='detect')
    print("model_fn success")
    return model

def input_fn(request_body, request_content_type):
    print("Executing input_fn from inference.py ...")
    if request_content_type:
        jpg_original = np.load(io.BytesIO(request_body), allow_pickle=True)
        jpg_as_np = np.frombuffer(jpg_original, dtype=np.uint8)
        img = cv2.imdecode(jpg_as_np, flags=-1)
    else:
        raise Exception("Unsupported content type: " + request_content_type)
    print("input_fn success")
    return img
    
def predict_fn(input_data, model):
    print("Executing predict_fn from inference.py ...")
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model.to(device)
    with torch.no_grad():
        result = model.predict(input_data)
    print("predict_fn success")
    return result
        
def output_fn(prediction_output, content_type):
    print("Executing output_fn from inference.py ...")
    infer = {}
    for result in prediction_output:
        if result.boxes:
            infer['boxes'] = result.boxes.numpy().data.tolist()
        if result.masks:
            infer['masks'] = result.masks.numpy().data.tolist()
        if result.keypoints:
            infer['keypoints'] = result.keypoints.numpy().data.tolist()
        if result.probs:
            infer['probs'] = result.probs.numpy().data.tolist()
    print("output_fn success")
    return json.dumps(infer)