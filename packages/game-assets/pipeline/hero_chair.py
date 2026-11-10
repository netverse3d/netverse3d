import math

from mathutils import Vector

from hero_kit import HeroPart, smooth_table

LIFT = 0.07
HALF_WIDTH = [(0.34, 0.235), (0.48, 0.24), (0.62, 0.235), (0.76, 0.245), (0.88, 0.285), (0.96, 0.305), (1.02, 0.3), (1.08, 0.275), (1.13, 0.225), (1.17, 0.18), (1.21, 0.15), (1.24, 0.14), (1.26, 0.135)]
WING = [(0.34, 0.1), (0.5, 0.1), (0.62, 0.085), (0.75, 0.08), (0.86, 0.12), (0.96, 0.16), (1.04, 0.155), (1.12, 0.11), (1.18, 0.06), (1.22, 0.025), (1.26, 0.01)]
BULGE = [(0.34, 0.0), (0.5, -0.02), (0.62, -0.035), (0.75, -0.02), (0.9, 0.0), (1.02, -0.015), (1.12, 0.0), (1.2, 0.02), (1.26, 0.025)]
HEIGHTS = [0.34, 0.42, 0.5, 0.58, 0.64, 0.7, 0.76, 0.82, 0.88, 0.92, 0.955, 0.99, 1.025, 1.06, 1.09, 1.12, 1.145, 1.17, 1.19, 1.21, 1.225, 1.24, 1.25, 1.26]
LEAN = 0.14
THICKNESS = 0.095
SLOT_Z = 1.15
SLOT_X = 0.052
SLOT_SIZE = (0.038, 0.4, 0.085)
BACK_ROWS = ['strip', 'top', 'top', 'body', 'soft', 'soft', 'soft', 'soft', 'body', 'top', 'top', 'strip', 'body', 'body', 'body', 'body', 'body']


def back_center(z):
    return 0.205 + LEAN * (z - 0.42) + smooth_table(BULGE, z)


def back_ring(z):
    w = smooth_table(HALF_WIDTH, z)
    f = smooth_table(WING, z)
    y0 = back_center(z)
    front = [
        (-1.0, -0.9),
        (-0.97, -0.98),
        (-0.86, -0.85),
        (-0.70, -0.5),
        (-0.55, -0.1),
        (-0.28, 0.0),
        (0.0, 0.0),
        (0.28, 0.0),
        (0.55, -0.1),
        (0.70, -0.5),
        (0.86, -0.85),
        (0.97, -0.98),
        (1.0, -0.9),
    ]
    ring = [Vector((w * x, y0 + f * depth + (0.008 if x == 0 else 0.004 if abs(x) < 0.3 else 0.0), z)) for x, depth in front]
    ring += [
        Vector((w * 0.92, y0 + THICKNESS * 0.55, z)),
        Vector((w * 0.45, y0 + THICKNESS, z)),
        Vector((-w * 0.45, y0 + THICKNESS, z)),
        Vector((-w * 0.92, y0 + THICKNESS * 0.55, z)),
    ]
    return ring


def back_row(ring_index, column):
    return BACK_ROWS[column]


def headrest_slots():
    center_y = back_center(SLOT_Z) + 0.02
    return [{'center': (sign * SLOT_X, center_y, SLOT_Z), 'size': SLOT_SIZE, 'radius': 0.012} for sign in (-1, 1)]


SEAT_DROP = [(-0.265, 0.09), (-0.24, 0.035), (-0.19, 0.006), (-0.12, 0.0), (0.24, 0.012)]
SEAT_DEPTHS = [-0.265, -0.255, -0.24, -0.215, -0.19, -0.14, -0.09, -0.035, 0.02, 0.07, 0.12, 0.18, 0.24]
SEAT_TOP = 0.402
SEAT_BASE = 0.292
BOLSTER = [(-0.265, 0.018), (-0.15, 0.035), (0.0, 0.05), (0.24, 0.055)]
SEAT_ROWS = ['strip', 'top', 'top', 'top', 'soft', 'soft', 'soft', 'soft', 'top', 'top', 'top', 'strip', 'body', 'body', 'body', 'body', 'body']


def seat_ring(y):
    d = smooth_table(SEAT_DROP, y)
    top = SEAT_TOP - d
    base = SEAT_BASE + d * 0.2
    w = 0.265 if y < 0.12 else 0.25
    b = smooth_table(BOLSTER, y)
    profile = [
        (-1.0, 0.005),
        (-0.97, b * 0.9),
        (-0.88, b),
        (-0.72, b * 0.75),
        (-0.55, b * 0.25),
        (-0.3, 0.004),
        (0.0, 0.008),
        (0.3, 0.004),
        (0.55, b * 0.25),
        (0.72, b * 0.75),
        (0.88, b),
        (0.97, b * 0.9),
        (1.0, 0.005),
    ]
    ring = [Vector((w * x, y, top + lift)) for x, lift in profile]
    ring += [
        Vector((w * 1.0, y, base + 0.03)),
        Vector((w * 0.6, y, base)),
        Vector((-w * 0.6, y, base)),
        Vector((-w * 1.0, y, base + 0.03)),
    ]
    return ring


def seat_row(ring_index, column):
    return SEAT_ROWS[column]


ARM_STATIONS = [(0.05, 0.168, 0.034, 0.05), (0.19, 0.142, 0.03, 0.042), (0.33, 0.106, 0.024, 0.032)]
ARM_CHAMFER = 0.006
ARM_ROWS = ['metal', 'body', 'body', 'body', 'body', 'body']
ARM_TIP = 0.33
WHEEL_RADIUS = 0.027
WHEEL_WIDTH = 0.026


def arm_ring(direction, side, distance, top, height, width):
    base = direction * distance
    half = width / 2
    points = [
        (-half + ARM_CHAMFER, top),
        (half - ARM_CHAMFER, top),
        (half, top - ARM_CHAMFER),
        (half, top - height),
        (-half, top - height),
        (-half, top - ARM_CHAMFER),
    ]
    return [base + side * x + Vector((0, 0, z)) for x, z in points]


def base_arm(chair, direction):
    side = Vector((direction.y, -direction.x, 0))
    rings = [arm_ring(direction, side, *station) for station in ARM_STATIONS]
    chair.loft(rings, lambda r, c: ARM_ROWS[c], levels=0, smooth=False)


def caster(chair, center, radius, width, angle):
    center = Vector(center)
    axis = Vector((math.cos(angle), math.sin(angle), 0))
    forward = Vector((-math.sin(angle), math.cos(angle), 0))
    up = Vector((0, 0, 1))
    def wheel_ring(offset, r, n=14):
        return [center + axis * offset + forward * (r * math.cos(2 * math.pi * i / n)) + up * (r * math.sin(2 * math.pi * i / n)) for i in range(n)]
    half = width / 2
    rings = [
        wheel_ring(-half, radius * 0.5),
        wheel_ring(-half, radius * 0.84),
        wheel_ring(-half * 0.8, radius * 1.03),
        wheel_ring(half * 0.8, radius * 1.03),
        wheel_ring(half, radius * 0.84),
        wheel_ring(half, radius * 0.5),
    ]
    chair.loft(rings, lambda r, c: 'metal' if r in (0, 4) else 'body', levels=0, smooth=True)
    for side in (-1, 1):
        chair.cylinder_cap(center + axis * (half * side + side * 0.0025), axis, radius * 0.5, side, row='metal', segments=14)


def cylinder(chair, center, radius, z0, z1, row, segments=12):
    rings = [[Vector((center[0] + radius * math.cos(2 * math.pi * i / segments), center[1] + radius * math.sin(2 * math.pi * i / segments), z)) for i in range(segments)] for z in (z0, z1)]
    chair.loft(rings, lambda a, b: row, levels=0, smooth=True)


def build_upper_body(chair):
    chair.loft([back_ring(z) for z in HEIGHTS], back_row, levels=1, cutters=headrest_slots())
    chair.loft([seat_ring(y) for y in SEAT_DEPTHS], seat_row, levels=1)

    logo = 0.035
    logo_y = back_center(1.0) + 0.004
    chair.image_quad([(-logo, logo_y, 1.0 - logo), (logo, logo_y, 1.0 - logo), (logo, logo_y, 1.0 + logo), (-logo, logo_y, 1.0 + logo)], 'decal')

    for sign in (-1, 1):
        x = sign * 0.312
        chair.spoke((sign * 0.21, 0.05, 0.325), (x, 0.05, 0.345), 0.03, 0.03, 0.03, 0.03, 'body', levels=0)
        cylinder(chair, (x, 0.05), 0.022, 0.34, 0.59, 'metal')
        chair.rounded_box((x, 0.05, 0.585), (0.05, 0.07, 0.02), 'metal', radius=0.006, segments=1)
        chair.rounded_box((x, 0.02, 0.608), (0.09, 0.3, 0.028), 'body', radius=0.012, segments=2)
        chair.pillow((x, 0.02, 0.63), (0.084, 0.29, 0.02), 'soft', puff=0.1, levels=1, grid=2)
    for vertex in chair.bm.verts:
        vertex.co.z += LIFT


def build_base(chair):
    chair.rounded_box((0, 0.0, 0.345), (0.2, 0.24, 0.04), 'body', radius=0.006, segments=1)
    for z0, z1, r, row in ((0.17, 0.25, 0.042, 'body'), (0.25, 0.335, 0.026, 'metal')):
        cylinder(chair, (0, 0), r, z0, z1, row)
    hub = [[Vector((r * math.cos(2 * math.pi * i / 16), r * math.sin(2 * math.pi * i / 16), z)) for i in range(16)] for r, z in ((0.04, 0.112), (0.065, 0.118), (0.065, 0.172), (0.044, 0.182))]
    chair.loft(hub, lambda a, b: 'body', levels=0, smooth=True)
    for i in range(5):
        angle = 2 * math.pi * i / 5 + math.pi / 2
        direction = Vector((math.cos(angle), math.sin(angle), 0))
        base_arm(chair, direction)
        chair.rounded_box(tuple(direction * (ARM_TIP - 0.015) + Vector((0, 0, 0.066))), (0.028, 0.034, 0.044), 'body', radius=0.005, segments=1)
        caster(chair, direction * ARM_TIP + Vector((0, 0, WHEEL_RADIUS)), WHEEL_RADIUS, WHEEL_WIDTH, angle + math.pi / 2)


def build_hero_chair(name='chair_a'):
    chair = HeroPart(name)
    build_upper_body(chair)
    build_base(chair)
    return chair
