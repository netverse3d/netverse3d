import math

from mathutils import Vector

from hero_kit import HeroPart

CELL = 4.0
HALF = CELL / 2
GUTTER_OFFSET = 1.84
GUTTER_HALF = 0.14
GUTTER_END = HALF - 0.1
FLOAT = 0.0022
RIM = 0.0025
SIDEWALK_TOP = 0.15
WIRE_TOP = 6.65
WIRE_SAG = 0.35
LAMP_HEAD_Z = 4.55
LAMP_HEAD_HEIGHT = 0.12


def gutter(part, axis, offset, start=-GUTTER_END, end=GUTTER_END):
    def at(along, across, z):
        return (along, across, z) if axis == 'x' else (across, along, z)

    part.poly([at(start, offset - GUTTER_HALF, FLOAT), at(end, offset - GUTTER_HALF, FLOAT), at(end, offset + GUTTER_HALF, FLOAT), at(start, offset + GUTTER_HALF, FLOAT)], 'body')
    for step in range(-18, 19, 3):
        along = step / 10
        if start + 0.06 <= along <= end - 0.06:
            part.poly([at(along - 0.05, offset - 0.1, FLOAT * 2), at(along + 0.05, offset - 0.1, FLOAT * 2), at(along + 0.05, offset + 0.1, FLOAT * 2), at(along - 0.05, offset + 0.1, FLOAT * 2)], 'metal')


def manhole(part, x, y):
    part.revolve((x, y, RIM), 'z', [(0.3, 0.0, 'metal'), (0.3, 0.012, 'metal'), (0.26, 0.016, 'metal'), (0.001, 0.016, 'body')], segments=18, smooth=False)


def build_road(name, gutters):
    road = HeroPart(name)
    road.rounded_box((0, 0, -0.11), (CELL, CELL, 0.18), 'body', radius=0.004, segments=1)
    for x in (-1.0, 1.0):
        for y in (-1.0, 1.0):
            road.slab(x, y, 0.98, 0.98, 0.02, [(-0.03, 0.0, 'wall'), (-0.006, 0.0, 'wall'), (0.0, 0.01, 'wall')], corner=1)
    for axis, offset, end in gutters:
        gutter(road, axis, offset, end=end)
    manhole(road, 1.0, -0.6)
    return road


def build_road_a():
    return build_road('road_a', [('x', GUTTER_OFFSET, GUTTER_END), ('x', -GUTTER_OFFSET, GUTTER_END)])


def build_road_b():
    inner = GUTTER_OFFSET - GUTTER_HALF
    road = build_road('road_b', [('x', GUTTER_OFFSET, inner), ('y', GUTTER_OFFSET, inner)])
    corner = GUTTER_OFFSET
    road.poly([(inner, inner, FLOAT), (corner + GUTTER_HALF, inner, FLOAT), (corner + GUTTER_HALF, corner + GUTTER_HALF, FLOAT), (inner, corner + GUTTER_HALF, FLOAT)], 'body')
    return road


def build_road_c():
    return build_road('road_c', [('x', GUTTER_OFFSET, GUTTER_END)])


def build_sidewalk():
    walk = HeroPart('sidewalk_a')
    walk.slab(0, 0, HALF, 0.5, 0.02, [(0.0, 0.0, 'metal'), (SIDEWALK_TOP - 0.02, 0.0, 'metal'), (SIDEWALK_TOP, 0.02, 'top'), (SIDEWALK_TOP, 0.05, 'top')], corner=1)
    tile_z = SIDEWALK_TOP + FLOAT
    for x in range(-19, 20, 2):
        walk.poly([(x / 10 - 0.08, -0.42, tile_z), (x / 10 + 0.08, -0.42, tile_z), (x / 10 + 0.08, 0.42, tile_z), (x / 10 - 0.08, 0.42, tile_z)], 'floor')
    return walk


def build_pole():
    pole = HeroPart('pole_a')
    pole.revolve((0, 0, 0), 'z', [(0.14, 0.0, 'top'), (0.14, 0.12, 'top'), (0.11, 3.5, 'top'), (0.08, 7.0, 'top'), (0.001, 7.0, 'top')], segments=10, smooth=True)
    pole.rounded_box((0, 0, 6.5), (0.1, 1.3, 0.1), 'metal', radius=0.012, segments=1)
    for y in (-0.5, 0.0, 0.5):
        pole.revolve((0, y, 6.55), 'z', [(0.045, 0.0, 'soft'), (0.05, 0.06, 'soft'), (0.03, 0.1, 'soft'), (0.001, 0.1, 'soft')], segments=8, smooth=True)
    pole.rounded_box((0.33, 0.0, 5.4), (0.42, 0.44, 0.7), 'metal', radius=0.02, segments=1)
    pole.rounded_box((0.33, 0.0, 5.78), (0.3, 0.3, 0.06), 'body', radius=0.01, segments=1)
    coil = [(0.28 * math.cos(2 * math.pi * i / 10) + 0.05, 0.28 * math.sin(2 * math.pi * i / 10), 4.9 + 0.02 * i) for i in range(10)]
    pole.tube(coil, 0.014, 'body', sides=4, closed=True)
    return pole


def catenary(y, top, sag, points=9):
    return [((i / (points - 1)) * CELL - HALF, y, top - sag * (1 - ((i / (points - 1)) * 2 - 1) ** 2)) for i in range(points)]


def build_wires():
    wires = HeroPart('wires_a')
    for y in (-0.5, 0.0, 0.5):
        wires.tube(catenary(y, WIRE_TOP, WIRE_SAG), 0.012, 'body', sides=4)
    for y, sag in ((-0.25, 0.55), (0.3, 0.45)):
        wires.tube(catenary(y, 5.0, sag), 0.01, 'body', sides=3)
    return wires


def build_lamp():
    lamp = HeroPart('lamp_a')
    lamp.revolve((0, 0, 0), 'z', [(0.1, 0.0, 'metal'), (0.1, 0.25, 'metal'), (0.065, 0.3, 'metal'), (0.055, 4.2, 'metal'), (0.001, 4.2, 'metal')], segments=10, smooth=True)
    lamp.tube([(0, 0, 4.15), (0, -0.25, 4.42), (0, -0.6, 4.58), (0, -1.0, 4.6)], 0.045, 'metal', sides=6)
    lamp.rounded_box((0, -1.15, LAMP_HEAD_Z), (0.32, 0.62, LAMP_HEAD_HEIGHT), 'metal', radius=0.025, segments=2)
    panel_z = LAMP_HEAD_Z - LAMP_HEAD_HEIGHT / 2 - RIM
    lamp.oriented_poly([(-0.12, -1.4, panel_z), (0.12, -1.4, panel_z), (0.12, -0.9, panel_z), (-0.12, -0.9, panel_z)], (0, 0, -1), 'strip')
    return lamp


def build_bin():
    bin_part = HeroPart('bin_a')
    bin_part.revolve((0, 0, 0), 'z', [(0.19, 0.0, 'metal'), (0.22, 0.04, 'metal'), (0.22, 0.68, 'metal'), (0.245, 0.7, 'body'), (0.245, 0.77, 'body'), (0.13, 0.8, 'body'), (0.001, 0.8, 'body')], segments=12, smooth=True)
    bin_part.rounded_box((0, -0.255, 0.42), (0.16, 0.012, 0.22), 'strip', radius=0.004, segments=1)
    return bin_part


def build_planter():
    planter = HeroPart('planter_a')
    planter.slab(0, 0, 0.4, 0.4, 0.03, [(0.0, 0.04, 'metal'), (0.47, 0.0, 'metal'), (0.5, 0.0, 'metal'), (0.5, 0.03, 'soft'), (0.46, 0.05, 'soft')], corner=2)
    for cx, cy, cz, size in ((0.0, 0.0, 0.84, 0.62), (0.2, -0.14, 1.02, 0.44), (-0.18, 0.16, 0.98, 0.4), (0.05, 0.2, 1.2, 0.3)):
        planter.pillow((cx, cy, cz), (size, size, size * 0.9), 'top', puff=0.35, levels=1, grid=2)
    return planter


def leaning_panel(part, bottom_y, top_y, half_width, z0, z1, thickness, row):
    front = [Vector((-half_width, bottom_y, z0)), Vector((half_width, bottom_y, z0)), Vector((half_width, top_y, z1)), Vector((-half_width, top_y, z1))]
    winding = (front[1] - front[0]).cross(front[3] - front[0]).normalized()
    outward = winding if winding.y * bottom_y > 0 else -winding
    back = [point - outward * thickness for point in front]
    rings = [front, back] if winding.dot(-outward) > 0 else [list(reversed(front)), list(reversed(back))]
    part.loft(rings, lambda r, c: row, levels=0, closed=True, cap=True, smooth=False)
    face = [point + outward * FLOAT for point in front]
    inset = [face[0] * 0.92 + face[2] * 0.08, face[1] * 0.92 + face[3] * 0.08, face[2] * 0.92 + face[0] * 0.08, face[3] * 0.92 + face[1] * 0.08]
    part.oriented_poly(inset, outward, 'accent')


def build_board():
    board = HeroPart('board_a')
    leaning_panel(board, -0.3, -0.06, 0.3, 0.02, 0.98, 0.03, 'body')
    leaning_panel(board, 0.3, 0.06, 0.3, 0.02, 0.98, 0.03, 'body')
    board.rounded_box((0, 0, 1.0), (0.64, 0.14, 0.04), 'metal', radius=0.01, segments=1)
    return board
