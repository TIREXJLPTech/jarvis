"""
Detector de wake word "hey jarvis" via openWakeWord (Fase 3, alternativa ao
Picovoice depois que o trial gratuito deles foi negado de vez).

Não acessa o microfone sozinho: recebe audio PCM int16 mono 16kHz cru via
stdin (o processo Node em src/voice/index.ts que grava e alimenta este
script, quadro a quadro), e imprime a linha "WAKE" em stdout sempre que
detecta a wake word - o Node fica lendo essa saida em loop.

Uso: python scripts/wake_word/detect.py
Dependencias: pip install -r scripts/wake_word/requirements.txt
"""

import sys

import numpy as np
import openwakeword
from openwakeword.model import Model

# openWakeWord espera janelas de 80ms a 16kHz = 1280 amostras (2560 bytes,
# int16 = 2 bytes/amostra) - o Node manda quadros menores (512 amostras),
# entao acumulamos ate ter uma janela completa antes de rodar a inferencia.
WINDOW_SAMPLES = 1280
WINDOW_BYTES = WINDOW_SAMPLES * 2
THRESHOLD = 0.5


def main() -> None:
    # Baixa os pesos pre-treinados na primeira execucao (fica em cache local
    # depois disso, nao baixa de novo nas proximas vezes).
    openwakeword.utils.download_models()

    model = Model(wakeword_models=["hey_jarvis"], inference_framework="onnx")
    buffer = b""

    while True:
        chunk = sys.stdin.buffer.read(WINDOW_BYTES)
        if not chunk:
            break  # stdin fechado - o processo Node encerrou
        buffer += chunk

        while len(buffer) >= WINDOW_BYTES:
            window_bytes = buffer[:WINDOW_BYTES]
            buffer = buffer[WINDOW_BYTES:]

            frame = np.frombuffer(window_bytes, dtype=np.int16)
            scores = model.predict(frame)
            score = scores.get("hey_jarvis", 0.0)

            if score > THRESHOLD:
                print("WAKE", flush=True)
                model.reset()  # evita disparo repetido pro mesmo trecho de audio


if __name__ == "__main__":
    main()
