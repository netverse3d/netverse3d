import math

from mathutils import Vector

from hero_kit import HeroPart, smooth_table

STATIONS = [0.0, 0.05, 0.12, 0.22, 0.32, 0.42, 0.53, 0.64, 0.75, 0.86, 0.94, 1.0]
END_SCALE = [(0.0, 0.62), (0.05, 0.86), (0.12, 0.97), (0.22, 1.0), (0.86, 1.0), (0.94, 0.88), (1.0, 0.56)]
ARC_TURNS = [0.0, 0.1, 0.24, 0.38, 0.47, 0.53, 0.62, 0.76, 0.9, 1.0]
CHANNEL_POINTS = (4, 5)
CHANNEL_COLUMN = 4
GRIP_COLUMNS = (0, 8)
STRIP_COLUMNS = (9, 14)
BASE_COLUMNS = (10, 11, 12, 13)
SHELL_COLUMNS = (1, 2, 3, 5, 6, 7)
SPECS = {
    'a': {
        'length': 0.124,
        'radius': 0.004,
        'height': [(0.0, 0.017), (0.12, 0.027), (0.32, 0.036), (0.55, 0.041), (0.72, 0.039), (0.88, 0.029), (1.0, 0.016)],
        'width': [(0.0, 0.027), (0.12, 0.031), (0.35, 0.032), (0.57, 0.034), (0.79, 0.032), (0.94, 0.026), (1.0, 0.02)],
        'left': [(0.0, 1.0), (0.3, 1.08), (0.55, 1.16), (0.8, 1.08), (1.0, 1.0)],
        'apex': [(0.0, 0.0), (0.4, -0.12), (0.7, -0.16), (1.0, 0.0)],
        'channel': {'until': 0.42, 'depth': 0.0016},
        'wheel': {'at': 0.2, 'radius': 0.0105, 'width': 0.0062, 'rise': 0.0032, 'row': 'soft'},
        'button_split': 0.5,
        'button_row': 'top',
        'shell_row': 'body',
        'grip_row': 'soft',
        'strip_row': 'strip',
        'side_buttons': (0.34, 0.47),
        'thumb_wheel': None,
        'palm_light': 0.8,
    },
    'b': {
        'length': 0.113,
        'radius': 0.0028,
        'height': [(0.0, 0.009), (0.15, 0.015), (0.4, 0.02), (0.6, 0.021), (0.82, 0.017), (1.0, 0.009)],
        'width': [(0.0, 0.025), (0.15, 0.0275), (0.5, 0.0285), (0.85, 0.0275), (1.0, 0.025)],
        'left': [(0.0, 1.0), (1.0, 1.0)],
        'apex': [(0.0, 0.0), (1.0, 0.0)],
        'channel': None,
        'wheel': None,
        'button_split': 0.0,
        'button_row': 'top',
        'shell_row': 'top',
        'grip_row': 'top',
        'strip_row': 'metal',
        'side_buttons': (),
        'thumb_wheel': None,
        'palm_light': None,
    },
    'c': {
        'length': 0.126,
        'radius': 0.004,
        'height': [(0.0, 0.019), (0.12, 0.03), (0.35, 0.042), (0.58, 0.049), (0.78, 0.044), (0.92, 0.03), (1.0, 0.018)],
        'width': [(0.0, 0.025), (0.15, 0.029), (0.4, 0.031), (0.6, 0.031), (0.85, 0.029), (1.0, 0.02)],
        'left': [(0.0, 1.0), (0.25, 1.28), (0.5, 1.46), (0.75, 1.34), (1.0, 1.05)],
        'apex': [(0.0, 0.0), (0.4, -0.2), (0.7, -0.24), (1.0, -0.05)],
        'channel': {'until': 0.42, 'depth': 0.0014},
        'wheel': {'at': 0.21, 'radius': 0.011, 'width': 0.0075, 'rise': 0.0034, 'row': 'metal'},
        'button_split': 0.5,
        'button_row': 'body',
        'shell_row': 'body',
        'grip_row': 'soft',
        'strip_row': 'strip',
        'side_buttons': (0.3, 0.4),
        'thumb_wheel': 0.52,
        'palm_light': None,
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


def arc_point(height, right, left, apex, radius, theta):
    s = math.sin(theta)
    c = math.cos(theta)
    half = right if c > 0 else left
    x = -c * half + apex * s
    z = radius + (height - radius) * (s ** 0.8)
    return x, z


def channel_drop(spec, t):
    channel = spec['channel']
    if channel is None or t >= channel['until']:
        return 0.0
    fade = min(1.0, (channel['until'] - t) / 0.1)
    return channel['depth'] * fade


def body_ring(spec, t):
    height, width, left, apex = profile_params(spec, t)
    radius = spec['radius']
    y = station_y(spec, t)
    drop = channel_drop(spec, t)
    points = []
    for index, turn in enumerate(ARC_TURNS):
        x, z = arc_point(height, width, left, apex, radius, math.pi * turn)
        points.append((x, z - drop if index in CHANNEL_POINTS else z))
    points += [(left * 0.985, radius * 0.5), (left - radius, 0.0), (0.0, 0.0), (-width + radius, 0.0), (-width * 0.985, radius * 0.5)]
    return [Vector((x, y, z)) for x, z in points]


def body_row(spec):
    def row(ring_index, column):
        front = STATIONS[ring_index + 1] <= spec['button_split']
        at_end = ring_index in (0, len(STATIONS) - 2)
        if column in STRIP_COLUMNS:
            return spec['strip_row']
        if column in BASE_COLUMNS:
            return 'soft' if spec['strip_row'] == 'strip' else 'metal'
        if column == CHANNEL_COLUMN:
            in_channel = spec['channel'] is not None and STATIONS[ring_index + 1] <= spec['channel']['until']
            return 'soft' if in_channel else spec['shell_row']
        if column in GRIP_COLUMNS and not at_end:
            return spec['grip_row']
        if front and (column in SHELL_COLUMNS or column in GRIP_COLUMNS):
            return spec['button_row']
        return spec['shell_row']
    return row


def wheel(mouse, spec):
    settings = spec['wheel']
    height, _, _, apex = profile_params(spec, settings['at'])
    radius = settings['radius']
    center = (apex, station_y(spec, settings['at']), height - channel_drop(spec, settings['at']) - radius + settings['rise'])
    half = settings['width'] / 2
    mouse.revolve(center, 'x', [
        (radius * 0.72, -half, 'metal'),
        (radius * 0.96, -half * 0.8, settings['row']),
        (radius, -half * 0.4, settings['row']),
        (radius, half * 0.4, settings['row']),
        (radius * 0.96, half * 0.8, settings['row']),
        (radius * 0.72, half, 'metal'),
    ], segments=20, smooth=True)


def side_point(spec, t, turn, push):
    height, width, left, apex = profile_params(spec, t)
    x, z = arc_point(height, width, left, apex, spec['radius'], math.pi * turn)
    return x + push, station_y(spec, t), z


def side_buttons(mouse, spec):
    for t in spec['side_buttons']:
        mouse.rounded_box(side_point(spec, t, 0.84, -0.0012), (0.0044, 0.0135, 0.0042), 'metal', radius=0.0012, segments=1)


def thumb_wheel(mouse, spec):
    mouse.revolve(side_point(spec, spec['thumb_wheel'], 0.9, -0.0036), 'y', [
        (0.0035, -0.0042, 'metal'),
        (0.0052, -0.003, 'metal'),
        (0.0052, 0.003, 'metal'),
        (0.0035, 0.0042, 'metal'),
    ], segments=14, smooth=True)


def palm_light(mouse, spec):
    t = spec['palm_light']
    height, _, _, apex = profile_params(spec, t)
    mouse.revolve((apex, station_y(spec, t), height - 0.0012), 'z', [
        (0.0058, 0.0, 'accent'),
        (0.0058, 0.0016, 'accent'),
        (0.0036, 0.0022, 'accent'),
        (0.0005, 0.0024, 'accent'),
    ], segments=14, smooth=True)


def build_mouse(variant, name):
    spec = SPECS[variant]
    mouse = HeroPart(name)
    mouse.loft([body_ring(spec, t) for t in STATIONS], body_row(spec), levels=1)
    if spec['wheel']:
        wheel(mouse, spec)
    side_buttons(mouse, spec)
    if spec['thumb_wheel']:
        thumb_wheel(mouse, spec)
    if spec['palm_light']:
        palm_light(mouse, spec)
    return mouse


def build_mouse_a(name='mouse_a'):
    return build_mouse('a', name)


def build_mouse_b(name='mouse_b'):
    return build_mouse('b', name)


def build_mouse_c(name='mouse_c'):
    return build_mouse('c', name)
