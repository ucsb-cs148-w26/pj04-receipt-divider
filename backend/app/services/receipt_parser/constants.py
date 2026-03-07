"""
All tunable numeric constants used by the receipt-line reconstruction algorithm.
"""

import math

# Stage 1 - Global rotation estimation
ANGLE_PAIR_MAX_DY_FACTOR = 3
ANGLE_PAIR_MIN_DX_FACTOR = 0.5
ANGLE_PAIR_MAX_DX_FACTOR = 10
ANGLE_MAX_ABS_RAD = math.pi / 6
ANGLE_HISTOGRAM_BIN_DEG = 0.5

# Stage 2 - Line clustering
LINE_CLUSTER_Y_THRESHOLD_FACTOR = 0.6

# Stage 3 - RANSAC cluster splitting
RANSAC_SPLIT_THRESHOLD_FACTOR = 1.2
RANSAC_MIN_CLUSTER_SIZE = 3
RANSAC_INLIER_DIST_FACTOR = 0.4
RANSAC_MAX_ITERATIONS = 50
RANSAC_MIN_INLIERS = 2

# Stage 4 - Intra-line word ordering / fragment merging
FRAGMENT_MERGE_GAP_FACTOR = 0.3

# Stage 5 - Price column detection & price assignment
PRICE_COLUMN_MIN_PRICES = 2
PRICE_COLUMN_TOLERANCE_FACTOR = 3

# Edge case - Wrapped item names
WRAP_MAX_VERTICAL_GAP_FACTOR = 1.8
WRAP_MAX_LEFT_ALIGN_FACTOR = 3

# Stage 1b - Neighbor-graph tentative line building
NEIGHBOR_Y_OVERLAP_MIN = 0.6
NEIGHBOR_MAX_X_GAP_FACTOR = 14
NEIGHBOR_MAX_HEIGHT_RATIO = 2.0
NEIGHBOR_SHORT_GAP_FACTOR = 4
VECTOR_Y_TOLERANCE_FACTOR = 0.35

# Orphan price search radius
ORPHAN_SEARCH_RADIUS = 4

# Image preprocessing
MAX_IMAGE_DIMENSION = 2048
