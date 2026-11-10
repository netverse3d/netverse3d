import json
import os

from mathutils import Vector

from hero_kit import HeroPart

CATALOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'keyboards.json')
with open(CATALOG_PATH, encoding='utf-8') as handle:
    CATALOG = json.load(handle)
UNIT = CATALOG['unit']
KEY_GAP = 0.0011
TOP_INSET = 0.0019
SHOULDER_INSET = 0.0007
KEY_HEIGHT = 0.0085
ROW_RISE = 0.0006
LED_SIZE = 0.003
STYLES = {
    'a': {'margin': 0.007, 'height': 0.012, 'case': 'body', 'plate': 'soft', 'underglow': True, 'leds': 0},
    'b': {'margin': 0.009, 'height': 0.013, 'case': 'body', 'plate': 'soft', 'underglow': True, 'leds': 3},
    'c': {'margin': 0.006, 'height': 0.015, 'case': 'metal', 'plate': 'metal', 'underglow': False, 'leds': 2},
}


def layout_for(variant):
    return next(layout for layout in CATALOG['layouts'] if layout['variant'] == variant)


def strip_for(layout):
    return next(strip for strip in CATALOG['atlas']['strips'] if strip['id'] == layout['id'])


def key_uv(layout, strip, key):
    atlas = CATALOG['atlas']
    px = atlas['width'] / layout['width']
    py = strip['height'] / layout['depth']
    u0 = key['x'] * px / atlas['width']
    u1 = (key['x'] + key['w']) * px / atlas['width']
    v_far = 1 - (strip['y'] + key['y'] * py) / atlas['height']
    v_near = 1 - (strip['y'] + (key['y'] + key['h']) * py) / atlas['height']
    return u0, u1, v_far, v_near


def keycap(part, layout, strip, key, plate_top):
    half_width = layout['width'] * UNIT / 2
    half_depth = layout['depth'] * UNIT / 2
    left = half_width - key['x'] * UNIT - KEY_GAP
    right = half_width - (key['x'] + key['w']) * UNIT + KEY_GAP
    far = -half_depth + key['y'] * UNIT + KEY_GAP
    near = -half_depth + (key['y'] + key['h']) * UNIT - KEY_GAP
    top = plate_top + KEY_HEIGHT + (layout['depth'] - key['y'] - key['h']) * ROW_RISE

    def ring(inset, z):
        return [
            Vector((left - inset, near - inset, z)),
            Vector((right + inset, near - inset, z)),
            Vector((right + inset, far + inset, z)),
            Vector((left - inset, far + inset, z)),
        ]

    part.loft([ring(0.0, plate_top), ring(SHOULDER_INSET, top - 0.0012), ring(TOP_INSET, top)], lambda r, c: 'keycap', levels=0, cap=False, smooth=False)
    for face in part.last_faces:
        face[part.key_layer] = (key['x'] + key['w'] / 2) / layout['width']
    u0, u1, v_far, v_near = key_uv(layout, strip, key)
    part.image_rect([tuple(corner) for corner in ring(TOP_INSET, top)], 'legend', (u0, v_near, u1, v_far))


def build_keyboard(variant, name):
    layout = layout_for(variant)
    strip = strip_for(layout)
    style = STYLES[variant]
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
        keycap(part, layout, strip, key, height)
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
