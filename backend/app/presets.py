"""The group's Caribbean reef food web, before and after the blue whale fix.

Convention (same as the group spreadsheet): rows = prey, columns = predators.
matrix[i][j] = 1 means species i is eaten by species j.
"""

NAMES = [
    "Phytoplankton", "Macroalgae", "Zooplankton", "Sea Urchin", "Parrotfish",
    "Damselfish", "Snapper", "Grouper", "Octopus", "Barracuda", "Blue Whale",
]

ORIGINAL = [
    # Ph Ma Zo Ur Pa Da Sn Gr Oc Ba Wh
    [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],  # Phytoplankton
    [0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],  # Macroalgae
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],  # Zooplankton
    [0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0],  # Sea Urchin
    [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],  # Parrotfish
    [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0],  # Damselfish
    [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],  # Snapper
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],  # Grouper
    [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],  # Octopus
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],  # Barracuda
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],  # Blue Whale
]

# Blue whales eat zooplankton (krill), not phytoplankton.
CORRECTED = [row[:] for row in ORIGINAL]
CORRECTED[0][10] = 0
CORRECTED[2][10] = 1

PRESETS = {
    "reef": {
        "label": "Reef data",
        "description": "Caribbean reef food web, 11 species",
        "names": NAMES,
        "matrix": CORRECTED,
    },
}