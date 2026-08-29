"""Genera la matriu de confusio de la classificacio de risc (Taula -> Figura).

Dades procedents de les 80 observacions controlades descrites al Capitol 5.
Sortida: overleaf/imgs/matriu_confusio.pdf (vectorial, per a \\includegraphics).

Execucio:
    python overleaf/scripts/plot_matriu_confusio.py
"""

from pathlib import Path

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap

# --- Dades de l'avaluacio -------------------------------------------------
# Files: classe real (positiva, negativa)
# Columnes: prediccio del sistema (positiva, negativa)
VP, FN = 30, 7
FP, VN = 0, 43

matriu = np.array([[VP, FN],
                   [FP, VN]])

sigles = np.array([["VP", "FN"],
                   ["FP", "VN"]])

etiquetes_columna = ["Predicció\npositiva", "Predicció\nnegativa"]
etiquetes_fila = ["Classe real\npositiva", "Classe real\nnegativa"]

# --- Estil coherent amb la memoria (Times / serif) ------------------------
plt.rcParams.update({
    "font.family": "serif",
    "font.serif": ["Times New Roman", "DejaVu Serif"],
    "axes.linewidth": 0.8,
    "pdf.fonttype": 42,
})

# Degradat blau discret, suficient per llegir la densitat sense saturar
cmap = LinearSegmentedColormap.from_list(
    "tfg_blues", ["#f7fbff", "#c6dbef", "#6baed6", "#2171b5", "#08306b"]
)

fig, ax = plt.subplots(figsize=(5.6, 4.2))

total = matriu.sum()
imatge = ax.imshow(matriu, cmap=cmap, vmin=0, vmax=matriu.max())

# --- Anotacio de cada cel·la ---------------------------------------------
llindar = matriu.max() * 0.55
for i in range(2):
    for j in range(2):
        valor = matriu[i, j]
        color_text = "white" if valor > llindar else "#1a1a1a"
        ax.text(j, i - 0.13, f"{valor}",
                ha="center", va="center",
                fontsize=26, fontweight="bold", color=color_text)
        # Separador decimal amb coma, coherent amb la resta de la memoria
        percentatge = f"{valor / total * 100:.2f}".replace(".", ",")
        ax.text(j, i + 0.20, f"{sigles[i, j]} · {percentatge} %",
                ha="center", va="center",
                fontsize=11, color=color_text)

# --- Eixos ----------------------------------------------------------------
ax.set_xticks([0, 1], labels=etiquetes_columna, fontsize=11)
ax.set_yticks([0, 1], labels=etiquetes_fila, fontsize=11)
ax.xaxis.set_label_position("top")
ax.xaxis.tick_top()
ax.tick_params(axis="both", which="both", length=0)

# Linies separadores nitides entre cel·les
ax.set_xticks(np.arange(-0.5, 2, 1), minor=True)
ax.set_yticks(np.arange(-0.5, 2, 1), minor=True)
ax.grid(which="minor", color="white", linewidth=2.5)
for costat in ax.spines.values():
    costat.set_visible(False)

barra = fig.colorbar(imatge, ax=ax, shrink=0.82, pad=0.03)
barra.set_label("Nombre d'observacions", fontsize=10)
barra.outline.set_visible(False)
barra.ax.tick_params(labelsize=9, length=0)

fig.tight_layout()

desti = Path(__file__).resolve().parents[1] / "imgs" / "matriu_confusio.pdf"
desti.parent.mkdir(parents=True, exist_ok=True)
fig.savefig(desti, bbox_inches="tight")
fig.savefig(desti.with_suffix(".png"), dpi=300, bbox_inches="tight")
print(f"Generat: {desti}")
print(f"Total observacions: {total} (positives: {VP + FN}, negatives: {FP + VN})")
