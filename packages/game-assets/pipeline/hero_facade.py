from mathutils import Vector

from hero_kit import HeroPart
from hero_street import FLOAT

WIDTH = 4.0
HALF = WIDTH / 2
STOREY = 3.4
WALL_DEPTH = 0.3
FACE = -WALL_DEPTH / 2
PILASTER = 0.3
DOOR_WIDTH = 2.8
DOOR_HEIGHT = 2.5


def wall_slab(part, z0, z1, row='wall'):
    part.rounded_box((0, 0, (z0 + z1) / 2), (WIDTH, WALL_DEPTH, z1 - z0), row, radius=0.004, segments=1)


def pilasters(part, z0, z1, row='top'):
    for x in (-HALF + PILASTER / 2, HALF - PILASTER / 2):
        part.rounded_box((x, FACE - 0.03, (z0 + z1) / 2 + 0.01), (PILASTER, 0.06, z1 - z0 - 0.02), row, radius=0.006, segments=1)


def front_quad(x0, x1, z0, z1, y):
    return [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)]


def build_shopfront():
    front = HeroPart('shopfront_a')
    wall_slab(front, 0.0, STOREY)
    pilasters(front, 0.0, STOREY)
    front.rounded_box((0, FACE - 0.02, 0.06), (WIDTH - 2 * PILASTER, 0.04, 0.12), 'top', radius=0.004, segments=1)
    door_y = FACE - 0.012
    front.oriented_poly(front_quad(-DOOR_WIDTH / 2, DOOR_WIDTH / 2, 0.12, 0.12 + DOOR_HEIGHT, door_y), (0, -1, 0), 'metal')
    slat_y = door_y - FLOAT
    for i in range(1, 18):
        z = 0.12 + i * DOOR_HEIGHT / 18
        front.oriented_poly(front_quad(-DOOR_WIDTH / 2 + 0.02, DOOR_WIDTH / 2 - 0.02, z - 0.012, z + 0.012, slat_y), (0, -1, 0), 'body')
    front.rounded_box((0, FACE - 0.05, 0.12 + DOOR_HEIGHT + 0.06), (DOOR_WIDTH + 0.16, 0.1, 0.12), 'metal', radius=0.01, segments=1)
    sign_z = 0.12 + DOOR_HEIGHT + 0.14
    sign_height = 0.5
    sign_width = 2.0
    front.rounded_box((0, FACE - 0.08, sign_z + sign_height / 2), (sign_width, 0.16, sign_height), 'body', radius=0.012, segments=1)
    face_y = FACE - 0.16 - FLOAT
    face_half = (sign_height - 0.04) * 2
    front.image_rect([(-face_half, face_y, sign_z + 0.02), (face_half, face_y, sign_z + 0.02), (face_half, face_y, sign_z + sign_height - 0.02), (-face_half, face_y, sign_z + sign_height - 0.02)], 'decal', (0, 0, 1, 1))
    for z in (sign_z + 0.01, sign_z + sign_height - 0.01):
        front.tube([(-sign_width / 2 - 0.06, face_y - 0.01, z), (sign_width / 2 + 0.06, face_y - 0.01, z)], 0.012, 'strip', sides=6)
    awning_z = sign_z + sign_height + 0.06
    awning = [Vector((-1.9, FACE - 0.02, awning_z + 0.06)), Vector((1.9, FACE - 0.02, awning_z + 0.06)), Vector((1.9, FACE - 0.9, awning_z - 0.22)), Vector((-1.9, FACE - 0.9, awning_z - 0.22))]
    under = [point + Vector((0, 0, -0.03)) for point in awning]
    front.loft([awning, under], lambda r, c: 'soft' if r == 0 else 'top', levels=0, closed=True, cap=True, smooth=False)
    for x in (-1.7, 1.7):
        front.tube([(x, FACE - 0.01, awning_z - 0.5), (x, FACE - 0.78, awning_z - 0.2)], 0.018, 'metal', sides=4)
    return front


def balcony(part, z, depth=1.0, rail_height=1.05):
    part.rounded_box((0, FACE - depth / 2, z + 0.06), (WIDTH - 0.08, depth, 0.12), 'top', radius=0.01, segments=1)
    rail_y = FACE - depth + 0.05
    bars = 16
    for i in range(0, bars + 1):
        x = -1.9 + i * 3.8 / bars
        part.tube([(x, rail_y, z + 0.12), (x, rail_y, z + 0.12 + rail_height)], 0.015, 'metal', sides=4)
    part.rounded_box((0, rail_y, z + 0.12 + rail_height), (WIDTH - 0.1, 0.05, 0.05), 'metal', radius=0.008, segments=1)
    for side in (-1, 1):
        x = side * (HALF - 0.06)
        part.tube([(x, FACE - 0.02, z + 0.12 + rail_height), (x, rail_y, z + 0.12 + rail_height)], 0.013, 'metal', sides=4)
        for j in range(1, 4):
            part.tube([(x, FACE - j * depth / 4 + 0.02, z + 0.12), (x, FACE - j * depth / 4 + 0.02, z + 0.12 + rail_height)], 0.015, 'metal', sides=4)


def window(part, x, z, width, height, glass_row='screen'):
    frame_y = FACE - 0.03
    part.rounded_box((x, frame_y, z + height / 2), (width, 0.06, height), 'metal', radius=0.008, segments=1)
    part.oriented_poly(front_quad(x - width / 2 + 0.05, x + width / 2 - 0.05, z + 0.05, z + height - 0.05, frame_y - 0.03 - FLOAT), (0, -1, 0), glass_row)
    part.rounded_box((x, frame_y - 0.03, z + height / 2), (0.04, 0.02, height - 0.1), 'metal', radius=0.004, segments=1)


def air_conditioner(part, x, z):
    part.rounded_box((x, FACE - 0.2, z), (0.75, 0.3, 0.5), 'metal', radius=0.015, segments=1)
    part.revolve((x, FACE - 0.35 - FLOAT, z), 'y', [(0.16, 0.0, 'body'), (0.16, 0.012, 'body'), (0.001, 0.012, 'body')], segments=14, smooth=False)
    part.rounded_box((x, FACE - 0.18, z - 0.3), (0.5, 0.34, 0.04), 'metal', radius=0.006, segments=1)


def build_storey_a():
    storey = HeroPart('storey_a')
    wall_slab(storey, 0.0, STOREY)
    pilasters(storey, 0.12, STOREY)
    balcony(storey, 0.0)
    storey.rounded_box((0, FACE - 0.012, 0.12 + 1.15), (2.2, 0.024, 2.3), 'body', radius=0.004, segments=1)
    window(storey, -0.55, 0.3, 1.0, 2.1)
    window(storey, 0.55, 0.3, 1.0, 2.1)
    return storey


def build_storey_b():
    storey = HeroPart('storey_b')
    wall_slab(storey, 0.0, STOREY)
    pilasters(storey, 0.0, STOREY)
    storey.rounded_box((0, FACE - 0.02, 0.04), (WIDTH - 2 * PILASTER, 0.04, 0.08), 'top', radius=0.004, segments=1)
    window(storey, -0.8, 1.0, 1.4, 1.5)
    window(storey, 0.9, 1.0, 1.2, 1.5)
    storey.rounded_box((0.9, FACE - 0.1, 0.96), (1.4, 0.2, 0.08), 'top', radius=0.008, segments=1)
    air_conditioner(storey, -0.95, 0.5)
    storey.tube([(1.75, FACE - 0.06, 0.05), (1.75, FACE - 0.06, STOREY - 0.05)], 0.035, 'metal', sides=6)
    return storey


SHEET_FRONT = (0.1, 0.7)
SHEET_BACK = (0.95, 0.5)


def sheet_z(y):
    front_y, front_z = SHEET_FRONT
    back_y, back_z = SHEET_BACK
    return front_z + (back_z - front_z) * (y - front_y) / (back_y - front_y)


def build_roof():
    roof = HeroPart('roof_a')
    wall_slab(roof, 0.0, 0.7)
    roof.rounded_box((0, FACE - 0.03, 0.72), (WIDTH - 0.04, 0.12, 0.08), 'top', radius=0.008, segments=1)
    pilasters(roof, 0.0, 0.68)
    sheet = [Vector((-1.95, SHEET_FRONT[0], SHEET_FRONT[1])), Vector((1.95, SHEET_FRONT[0], SHEET_FRONT[1])), Vector((1.95, SHEET_BACK[0], SHEET_BACK[1])), Vector((-1.95, SHEET_BACK[0], SHEET_BACK[1]))]
    under = [point + Vector((0, 0, -0.04)) for point in sheet]
    roof.loft([list(reversed(sheet)), list(reversed(under))], lambda r, c: 'metal', levels=0, closed=True, cap=True, smooth=False)
    for i in range(0, 13):
        x = -1.8 + i * 0.3
        roof.tube([(x, 0.12, sheet_z(0.12) + 0.012), (x, 0.93, sheet_z(0.93) + 0.012)], 0.02, 'metal', sides=3)
    roof.revolve((1.1, 0.52, 0.5), 'z', [(0.4, 0.0, 'metal'), (0.4, 0.9, 'metal'), (0.27, 1.0, 'metal'), (0.001, 1.0, 'metal')], segments=14, smooth=True)
    roof.tube([(-1.4, 0.5, 0.5), (-1.4, 0.5, 2.1)], 0.02, 'metal', sides=4)
    roof.rounded_box((-1.4, 0.5, 2.0), (0.6, 0.03, 0.03), 'metal', radius=0.004, segments=1)
    return roof
