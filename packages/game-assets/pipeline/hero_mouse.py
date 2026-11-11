import math

from mathutils import Vector

from hero_kit import HeroPart, smooth_table

STATIONS = [0.0, 0.06, 0.14, 0.24, 0.35, 0.46, 0.57, 0.68, 0.79, 0.89, 0.96, 1.0]
END_SCALE = [(0.0, 0.3), (0.06, 0.7), (0.14, 0.92), (0.24, 1.0), (0.89, 1.0), (0.96, 0.82), (1.0, 0.35)]
ARC_STEPS = 6
STRIP_COLUMNS = (6, 7, 10, 11)
GRIP_COLUMNS = (0, 5)
BUTTON_STATIONS = [0.05, 0.14, 0.24, 0.34, 0.44, 0.52]
BUTTON_LIFT = 0.0012
SPECS = {
    'a': {
        'length': 0.125,
        'radius': 0.004,
        'height': [(0.0, 0.016), (0.14, 0.026), (0.35, 0.036), (0.57, 0.042), (0.72, 0.04), (0.89, 0.028), (1.0, 0.014)],
        'width': [(0.0, 0.018), (0.14, 0.028), (0.35, 0.033), (0.57, 0.034), (0.79, 0.03), (0.96, 0.02), (1.0, 0.014)],
        'left': [(0.0, 1.0), (0.3, 1.15), (0.55, 1.25), (0.8, 1.1), (1.0, 1.0)],
        'apex': [(0.0, 0.0), (0.4, -0.15), (0.7, -0.2), (1.0, 0.0)],
        'grips': True,
        'buttons': True,
        'side_buttons': (0.3, 0.4),
        'thumb_wheel': False,
        'wheel_row': 'body',
    },
    'b': {
        'length': 0.118,
        'radius': 0.003,
        'height': [(0.0, 0.014), (0.2, 0.026), (0.5, 0.036), (0.75, 0.032), (1.0, 0.012)],
        'width': [(0.0, 0.016), (0.2, 0.027), (0.5, 0.031), (0.8, 0.028), (1.0, 0.013)],
        'left': [(0.0, 1.0), (1.0, 1.0)],
        'apex': [(0.0, 0.0), (1.0, 0.0)],
        'grips': False,
        'buttons': False,
        'side_buttons': (),
        'thumb_wheel': False,
        'wheel_row': 'metal',
    },
    'c': {
        'length': 0.126,
        'radius': 0.004,
        'height': [(0.0, 0.018), (0.15, 0.03), (0.4, 0.042), (0.6, 0.048), (0.8, 0.042), (1.0, 0.016)],
        'width': [(0.0, 0.017), (0.15, 0.026), (0.4, 0.03), (0.6, 0.03), (0.85, 0.026), (1.0, 0.013)],
        'left': [(0.0, 1.0), (0.25, 1.3), (0.5, 1.5), (0.75, 1.35), (1.0, 1.05)],
        'apex': [(0.0, 0.0), (0.4, -0.22), (0.7, -0.26), (1.0, -0.05)],
        'grips': True,
        'buttons': True,
        'side_buttons': (0.32, 0.41),
        'thumb_wheel': True,
        'wheel_row': 'metal',
    },
}


def station_y(spec, t):
    return -spec['length'] / 2 + t * spec['length']


def profile_params(spec, t):
    scale = smooth_table(END_SCALE, t)
    height = smooth_table(spec['height'], t) * scale
    width = smooth_table(spec['width'], t) * scale
    left = width * smooth_table(spec['left'], t)
    apex = smooth_table(spec['apex'], t) * width
    return height, width, left, apex


def arc_point(height, right, left, apex, radius, theta, lift=0.0):
    s = math.sin(theta)
    c = math.cos(theta)
    half = (right if c > 0 else left) + lift
    x = -c * half + apex * s
    z = radius + (height - radius + lift) * (s ** 0.85)
    return x, z


def body_ring(spec, t):
    height, width, left, apex = profile_params(spec, t)
    radius = spec['radius']
    y = station_y(spec, t)
    points = [arc_point(height, width, left, apex, radius, math.pi * i / ARC_STEPS) for i in range(ARC_STEPS + 1)]
    points += [(left * 0.97, radius * 0.35), (left - radius, 0.0), (0.0, 0.0), (-width + radius, 0.0), (-width * 0.97, radius * 0.35)]
    return [Vector((x, y, z)) for x, z in points]


def body_row(spec):
    def row(ring_index, column):
        if column in STRIP_COLUMNS:
            return 'strip'
        if spec['grips'] and column in GRIP_COLUMNS:
            return 'soft'
        return 'body'
    return row


def button_shell(mouse, spec, theta_from, theta_to, columns=4):
    verts = []
    for t in BUTTON_STATIONS:
        height, width, left, apex = profile_params(spec, t)
        y = station_y(spec, t)
        for j in range(columns):
            theta = theta_from + (theta_to - theta_from) * j / (columns - 1)
            x, z = arc_point(height, width, left, apex, spec['radius'], theta, BUTTON_LIFT)
            verts.append(Vector((x, y, z)))
    faces = []
    for i in range(len(BUTTON_STATIONS) - 1):
        for j in range(columns - 1):
            a = i * columns + j
            faces.append([a, a + columns, a + columns + 1, a + 1])
    mouse.add_cage(verts, faces, ['top'] * len(faces), levels=1)


def wheel(mouse, spec, t, radius, width, row):
    height, _, _, apex = profile_params(spec, t)
    center = (apex, station_y(spec, t), height + BUTTON_LIFT - radius * 0.25)
    half = width / 2
    mouse.revolve(center, 'x', [
        (radius * 0.7, -half, row),
        (radius, -half * 0.7, 'accent'),
        (radius * 0.98, -half * 0.35, 'soft'),
        (radius * 0.98, half * 0.35, 'soft'),
        (radius, half * 0.7, 'accent'),
        (radius * 0.7, half, row),
    ], segments=16, smooth=True)


def side_point(spec, t, theta, push):
    height, width, left, apex = profile_params(spec, t)
    x, z = arc_point(height, width, left, apex, spec['radius'], theta)
    return x + push, station_y(spec, t), z


def side_buttons(mouse, spec):
    for t in spec['side_buttons']:
        mouse.rounded_box(side_point(spec, t, math.pi * 0.8, -0.0015), (0.006, 0.012, 0.005), 'top', radius=0.0015, segments=1)


def thumb_wheel(mouse, spec, t=0.45):
    mouse.revolve(side_point(spec, t, math.pi * 0.86, 0.001), 'y', [
        (0.004, -0.004, 'metal'),
        (0.007, -0.0025, 'metal'),
        (0.007, 0.0025, 'metal'),
        (0.004, 0.004, 'metal'),
    ], segments=12, smooth=True)


def build_mouse(variant, name):
    spec = SPECS[variant]
    mouse = HeroPart(name)
    mouse.loft([body_ring(spec, t) for t in STATIONS], body_row(spec), levels=1)
    if spec['buttons']:
        button_shell(mouse, spec, math.pi * 0.1, math.pi * 0.46)
        button_shell(mouse, spec, math.pi * 0.54, math.pi * 0.9)
    wheel(mouse, spec, 0.3, 0.0105, 0.0065, spec['wheel_row'])
    side_buttons(mouse, spec)
    if spec['thumb_wheel']:
        thumb_wheel(mouse, spec)
    return mouse


def build_mouse_a(name='mouse_a'):
    return build_mouse('a', name)


def build_mouse_b(name='mouse_b'):
    return build_mouse('b', name)


def build_mouse_c(name='mouse_c'):
    return build_mouse('c', name)
