import json
import os

from mathutils import Vector

from hero_kit import HeroPart

CATALOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'keyboards.json')
with open(CATALOG_PATH, encoding='utf-8') as handle:
    CATALOG = json.load(handle)
UNIT = CATALOG['unit']
SIDE_COLUMN = CATALOG['atlas']['sideColumn']
KEY_GAP = 0.0011
LED_SIZE = 0.003
PROFILES = {
    'oem': {'height': 0.0085, 'top_inset': 0.0019, 'shoulder_inset': 0.0007, 'shoulder_drop': 0.0012, 'rise': 0.0006},
    'low': {'height': 0.0036, 'top_inset': 0.0009, 'shoulder_inset': 0.0004, 'shoulder_drop': 0.0006, 'rise': 0.0},
}
STYLES = {
    'a': {'margin': 0.007, 'height': 0.012, 'case': 'body', 'plate': 'soft', 'underglow': True, 'leds': 0, 'profile': 'oem'},
    'b': {'margin': 0.009, 'height': 0.013, 'case': 'body', 'plate': 'soft', 'underglow': True, 'leds': 3, 'profile': 'oem'},
    'c': {'margin': 0.006, 'height': 0.015, 'case': 'metal', 'plate': 'metal', 'underglow': False, 'leds': 2, 'profile': 'oem'},
    'd': {'margin': 0.005, 'height': 0.008, 'case': 'metal', 'plate': 'metal', 'underglow': False, 'leds': 1, 'profile': 'low'},
    'e': {'margin': 0.009, 'height': 0.013, 'case': 'body', 'plate': 'soft', 'underglow': False, 'leds': 3, 'profile': 'oem'},
}


def layout_for(variant):
    return next(layout for layout in CATALOG['layouts'] if layout['variant'] == variant)


def strip_for(layout):
    return next(strip for strip in CATALOG['atlas']['strips'] if strip['id'] == layout['id'])


def cell_pixels(layout, strip, key):
    atlas = CATALOG['atlas']
    px = atlas['width'] / layout['width']
    py = strip['height'] / layout['depth']
    return key['x'] * px, strip['y'] + key['y'] * py, key['w'] * px, key['h'] * py


def blender_uv(x, y):
    atlas = CATALOG['atlas']
    return x / atlas['width'], 1 - y / atlas['height']


def top_rect(layout, strip, key):
    x, y, w, h = cell_pixels(layout, strip, key)
    u0, v_far = blender_uv(x, y)
    u1, v_near = blender_uv(x + w, y + h)
    return u0, v_near, u1, v_far


def side_rect(layout, strip, key, low, high):
    x, y, w, h = cell_pixels(layout, strip, key)
    bottom = y + h * SIDE_COLUMN['y1']
    span = h * (SIDE_COLUMN['y1'] - SIDE_COLUMN['y0'])
    u0, v_low = blender_uv(x + w * SIDE_COLUMN['x0'], bottom - span * low)
    u1, v_high = blender_uv(x + w * SIDE_COLUMN['x1'], bottom - span * high)
    return u0, v_low, u1, v_high


def keycap(part, layout, strip, key, plate_top, profile):
    half_width = layout['width'] * UNIT / 2
    half_depth = layout['depth'] * UNIT / 2
    left = half_width - key['x'] * UNIT - KEY_GAP
    right = half_width - (key['x'] + key['w']) * UNIT + KEY_GAP
    far = -half_depth + key['y'] * UNIT + KEY_GAP
    near = -half_depth + (key['y'] + key['h']) * UNIT - KEY_GAP
    top = plate_top + profile['height'] + (layout['depth'] - key['y'] - key['h']) * profile['rise']
    shoulder = top - profile['shoulder_drop']

    def ring(inset, z):
        return [
            (left - inset, near - inset, z),
            (right + inset, near - inset, z),
            (right + inset, far + inset, z),
            (left - inset, far + inset, z),
        ]

    levels = [
        (ring(0.0, plate_top), 0.0),
        (ring(profile['shoulder_inset'], shoulder), (shoulder - plate_top) / (top - plate_top)),
        (ring(profile['top_inset'], top), 1.0),
    ]
    for (lower, low_fraction), (upper, high_fraction) in zip(levels, levels[1:]):
        rect = side_rect(layout, strip, key, low_fraction, high_fraction)
        for column in range(4):
            following = (column + 1) % 4
            part.image_rect([lower[column], lower[following], upper[following], upper[column]], 'legend', rect)
    part.image_rect(levels[-1][0], 'legend', top_rect(layout, strip, key))


def build_keyboard(variant, name):
    layout = layout_for(variant)
    strip = strip_for(layout)
    style = STYLES[variant]
    profile = PROFILES[style['profile']]
    part = HeroPart(name)
    half_width = layout['width'] * UNIT / 2 + style['margin']
    half_depth = layout['depth'] * UNIT / 2 + style['margin']
    height = style['height']
    foot = [(0.0, 0.004, 'strip'), (0.0035, 0.0, 'strip')] if style['underglow'] else [(0.0, 0.003, style['case']), (0.003, 0.0, style['case'])]
    part.slab(0, 0, half_width, half_depth, 0.006, foot + [
        (height - 0.003, 0.0, style['case']),
        (height, 0.0025, style['case']),
        (height + 0.0003, 0.006, style['plate']),
    ])
    for key in layout['keys']:
        keycap(part, layout, strip, key, height, profile)
    for index in range(style['leds']):
        x = -half_width + style['margin'] * 1.2 + index * LED_SIZE * 2
        part.rounded_box((x, -half_depth + style['margin'] / 2, height + 0.0006), (LED_SIZE, LED_SIZE, 0.0016), 'screen', radius=0.0005, segments=1)
    part.rounded_box((0, -half_depth - 0.003, height / 2), (0.012, 0.012, 0.006), 'body', radius=0.002, segments=1)
    return part


def build_keyboard_a(name='keyboard_a'):
    return build_keyboard('a', name)


def build_keyboard_b(name='keyboard_b'):
    return build_keyboard('b', name)


def build_keyboard_c(name='keyboard_c'):
    return build_keyboard('c', name)


def build_keyboard_d(name='keyboard_d'):
    return build_keyboard('d', name)


def build_keyboard_e(name='keyboard_e'):
    return build_keyboard('e', name)
