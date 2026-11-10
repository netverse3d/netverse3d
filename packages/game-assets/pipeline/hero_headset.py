import math

from mathutils import Vector

from hero_kit import HeroPart, rounded_rect

BAND_CENTER = Vector((0.0, 0.0, 0.165))
CUP_X = 0.104
CUP_Z = 0.14
HANGER_Z = 0.24
SPECS = {
    'a': {
        'cup_radius': 0.048,
        'cup_depth': 0.05,
        'cushion': 0.018,
        'band_radius': 0.105,
        'band_width': 0.03,
        'band_thickness': 0.011,
        'band_row': 'body',
        'pad_row': 'soft',
        'shell_row': 'body',
        'ring_row': 'accent',
        'boom': True,
        'stand_glow': True,
    },
    'b': {
        'cup_radius': 0.052,
        'cup_depth': 0.046,
        'cushion': 0.022,
        'band_radius': 0.108,
        'band_width': 0.036,
        'band_thickness': 0.012,
        'band_row': 'soft',
        'pad_row': 'soft',
        'shell_row': 'metal',
        'ring_row': 'metal',
        'boom': False,
        'stand_glow': False,
    },
    'c': {
        'cup_radius': 0.038,
        'cup_depth': 0.034,
        'cushion': 0.014,
        'band_radius': 0.1,
        'band_width': 0.022,
        'band_thickness': 0.009,
        'band_row': 'top',
        'pad_row': 'soft',
        'shell_row': 'top',
        'ring_row': 'strip',
        'boom': False,
        'stand_glow': True,
    },
}


def arc_band(part, center, radius, width, thickness, row, start=-8, stop=188, step=12):
    rings = []
    tangents = []
    for degrees in range(start, stop + 1, step):
        a = math.radians(degrees)
        normal = Vector((math.cos(a), 0.0, math.sin(a)))
        position = center + normal * radius
        rings.append([position + Vector((0.0, u, 0.0)) + normal * v for u, v in reversed(rounded_rect(0.0, 0.0, width / 2, thickness / 2, thickness * 0.45, 2))])
        tangents.append(Vector((-math.sin(a), 0.0, math.cos(a))))
    part.loft(rings, lambda r, c: row, levels=0, smooth=True, cap=False)
    part.oriented_poly([tuple(p) for p in rings[0]], -tangents[0], row)
    part.oriented_poly([tuple(p) for p in rings[-1]], tangents[-1], row)


def cup_profile(spec):
    r = spec['cup_radius']
    depth = spec['cup_depth']
    cushion = spec['cushion']
    pad = spec['pad_row']
    shell = spec['shell_row']
    return [
        (r * 0.55, 0.0, pad),
        (r * 0.88, 0.003, pad),
        (r * 0.99, cushion * 0.45, pad),
        (r * 0.97, cushion, pad),
        (r * 0.93, cushion + 0.003, shell),
        (r, cushion + 0.012, shell),
        (r, depth - 0.016, shell),
        (r * 0.94, depth - 0.006, shell),
        (r * 0.8, depth - 0.001, shell),
        (r * 0.62, depth, spec['ring_row']),
        (r * 0.5, depth, shell),
        (r * 0.2, depth - 0.002, shell),
        (0.001, depth - 0.002, shell),
    ]


def ear_cup(part, spec, side):
    profile = cup_profile(spec)
    if side < 0:
        profile = [(r, -along, row) for r, along, row in reversed(profile)]
    x = side * (CUP_X - spec['cup_depth'] / 2)
    part.revolve((x, 0.0, CUP_Z), 'x', profile, segments=20, smooth=True)
    recess = side * 0.006
    part.revolve((x, 0.0, CUP_Z), 'x', [(spec['cup_radius'] * 0.56, recess, 'body'), (0.001, recess, 'body')] if side > 0 else [(0.001, recess, 'body'), (spec['cup_radius'] * 0.56, recess, 'body')], segments=20, smooth=True)


def yoke(part, spec, side):
    top = BAND_CENTER + Vector((side * spec['band_radius'] * math.cos(math.radians(8)), 0.0, spec['band_radius'] * math.sin(math.radians(8))))
    back_x = side * (CUP_X + spec['cup_depth'] / 2)
    arm_x = back_x + side * 0.006
    part.tube([top, Vector((arm_x, 0.0, CUP_Z + spec['cup_radius'] * 0.75)), Vector((arm_x, 0.0, CUP_Z + spec['cup_radius'] * 0.2))], 0.0045, 'metal', sides=8)
    profile = [(0.012, -0.01, 'metal'), (0.012, 0.012, 'metal'), (0.001, 0.012, 'metal')]
    if side < 0:
        profile = [(r, -along, row) for r, along, row in reversed(profile)]
    part.revolve((back_x, 0.0, CUP_Z), 'x', profile, segments=14, smooth=True)


def boom_mic(part, spec):
    base = Vector((CUP_X - spec['cup_depth'] / 2 + 0.01, -spec['cup_radius'] * 0.7, CUP_Z - spec['cup_radius'] * 0.3))
    points = [base, base + Vector((0.0, -0.03, -0.015)), base + Vector((-0.02, -0.06, -0.04)), base + Vector((-0.045, -0.075, -0.055))]
    part.tube(points, 0.0035, 'body', sides=8)
    tip = points[-1]
    part.revolve(tip, 'y', [(0.001, -0.014, 'body'), (0.007, -0.01, 'body'), (0.0075, 0.0, 'soft'), (0.006, 0.008, 'soft'), (0.001, 0.011, 'soft')], segments=12, smooth=True)


def stand(part, spec):
    foot = [(0.0, 0.0, 'strip'), (0.007, 0.0, 'strip')] if spec['stand_glow'] else [(0.0, 0.0, 'body'), (0.007, 0.0, 'body')]
    part.slab(0, 0, 0.082, 0.082, 0.03, foot + [(0.014, 0.0, 'body'), (0.024, 0.008, 'top'), (0.026, 0.02, 'top')])
    part.revolve((0, 0, 0.022), 'z', [(0.02, 0.0, 'body'), (0.015, 0.012, 'metal'), (0.012, 0.03, 'metal'), (0.011, HANGER_Z - 0.04, 'metal'), (0.001, HANGER_Z - 0.04, 'metal')], segments=14, smooth=True)
    part.rounded_box((0, 0, HANGER_Z), (0.11, 0.036, 0.026), 'body', radius=0.011, segments=2)


def build_headset(variant, name):
    spec = SPECS[variant]
    part = HeroPart(name)
    stand(part, spec)
    arc_band(part, BAND_CENTER, spec['band_radius'], spec['band_width'], spec['band_thickness'], spec['band_row'])
    arc_band(part, BAND_CENTER, spec['band_radius'] - spec['band_thickness'] * 0.9, spec['band_width'] * 0.8, spec['band_thickness'] * 0.7, spec['pad_row'], start=40, stop=140, step=10)
    for side in (-1, 1):
        ear_cup(part, spec, side)
        yoke(part, spec, side)
    if spec['boom']:
        boom_mic(part, spec)
    return part


def build_headset_a(name='headset_a'):
    return build_headset('a', name)


def build_headset_b(name='headset_b'):
    return build_headset('b', name)


def build_headset_c(name='headset_c'):
    return build_headset('c', name)
