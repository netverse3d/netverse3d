import math

from mathutils import Vector

from hero_chair import cylinder
from hero_kit import HeroPart

TABLE_TOP = 0.42
SOFA_SEATS = 3
SOFA_WIDTH = 1.9


def build_sofa(name='sofa_a'):
    sofa = HeroPart(name)
    sofa.rounded_box((0, 0.03, 0.22), (SOFA_WIDTH - 0.04, 0.84, 0.3), 'body', radius=0.03, segments=2)
    sofa.rounded_box((0, 0.3, 0.52), (SOFA_WIDTH - 0.08, 0.22, 0.62), 'body', radius=0.04, segments=2)
    for side in (-1, 1):
        sofa.rounded_box((side * 0.86, 0.06, 0.45), (0.18, 0.76, 0.22), 'body', radius=0.05, segments=2)
    pitch = (SOFA_WIDTH - 0.36) / SOFA_SEATS
    for index in range(SOFA_SEATS):
        x = -pitch * (SOFA_SEATS - 1) / 2 + pitch * index
        sofa.pillow((x, -0.08, 0.43), (pitch - 0.03, 0.6, 0.15), 'soft', puff=0.2, levels=1, grid=3)
        sofa.pillow((x, 0.14, 0.72), (pitch - 0.03, 0.17, 0.44), 'soft', puff=0.2, levels=1, grid=2)
    for x in (-0.82, 0.82):
        for y in (-0.32, 0.36):
            cylinder(sofa, (x, y), 0.018, 0.0, 0.1, 'metal', segments=10)
    return sofa


def build_table(name='table_a'):
    table = HeroPart(name)
    table.slab(0, 0, 0.55, 0.3, 0.03, [
        (TABLE_TOP - 0.04, 0.01, 'body'),
        (TABLE_TOP - 0.03, 0.0, 'body'),
        (TABLE_TOP - 0.004, 0.0, 'body'),
        (TABLE_TOP, 0.004, 'top'),
        (TABLE_TOP + 0.0002, 0.012, 'top'),
    ])
    table.rounded_box((0, 0, TABLE_TOP - 0.065), (1.0, 0.5, 0.05), 'body', radius=0.006, segments=1)
    for x in (-0.47, 0.47):
        for y in (-0.21, 0.21):
            table.rounded_box((x, y, 0.19), (0.05, 0.05, 0.38), 'metal', radius=0.006, segments=1)
    table.rounded_box((0, 0, 0.12), (0.96, 0.46, 0.02), 'body', radius=0.004, segments=1)
    return table


def build_console(name='console_a'):
    console = HeroPart(name)
    console.pillow((0, 0, 0.007), (0.40, 0.28, 0.014), 'top', puff=0.18, levels=1, grid=3)
    console.pillow((0, 0, 0.046), (0.36, 0.26, 0.064), 'body', puff=0.1, levels=1, grid=3)
    console.pillow((0, 0, 0.08), (0.33, 0.232, 0.006), 'strip', puff=0.0, levels=1, grid=2)
    console.pillow((0, 0, 0.091), (0.40, 0.28, 0.014), 'top', puff=0.18, levels=1, grid=3)
    console.rounded_box((0.14, 0.131, 0.03), (0.03, 0.006, 0.006), 'accent', radius=0.002, segments=1)
    console.revolve((-0.09, 0.0, 0.092), 'z', [(0.045, 0.0, 'top'), (0.045, 0.008, 'top'), (0.03, 0.011, 'top'), (0.001, 0.011, 'top')], segments=20, smooth=True)
    return console


GRIP_STATIONS = [(0.0, 0.0, 0.0, 1.0), (0.25, 0.012, -0.002, 0.96), (0.5, 0.026, -0.005, 0.88), (0.75, 0.042, -0.009, 0.74), (1.0, 0.057, -0.015, 0.5)]


def grip(pad, side):
    base = Vector((side * 0.05, 0.01, 0.022))
    rings = []
    for t, dy, dz, scale in GRIP_STATIONS:
        centre = base + Vector((side * 0.014 * t, dy, dz))
        rx, rz = 0.023 * scale, 0.019 * scale
        rings.append([centre + Vector((rx * math.cos(2 * math.pi * i / 10), 0.0, -rz * math.sin(2 * math.pi * i / 10))) for i in range(10)])
    pad.loft(rings, lambda r, c: 'body', levels=1, smooth=True)


def build_gamepad(name='gamepad_a'):
    pad = HeroPart(name)
    pad.pillow((0, -0.006, 0.022), (0.148, 0.066, 0.038), 'body', puff=0.28, levels=1, grid=3)
    for side in (-1, 1):
        grip(pad, side)
        pad.rounded_box((side * 0.052, -0.036, 0.03), (0.034, 0.014, 0.012), 'body', radius=0.004, segments=2)
        pad.rounded_box((side * 0.052, -0.036, 0.0405), (0.03, 0.012, 0.006), 'top', radius=0.002, segments=1)
        pad.revolve((side * 0.03, 0.012, 0.038), 'z', [(0.007, 0.0, 'metal'), (0.007, 0.009, 'metal'), (0.011, 0.012, 'soft'), (0.001, 0.012, 'soft')], segments=12, smooth=True)
    pad.rounded_box((0, -0.012, 0.043), (0.05, 0.03, 0.004), 'top', radius=0.002, segments=1)
    for dx, dy in ((0.0, -0.012), (0.0, 0.012), (-0.012, 0.0), (0.012, 0.0)):
        pad.revolve((0.058 + dx, -0.012 + dy, 0.0425), 'z', [(0.0045, 0.0, 'accent'), (0.0045, 0.003, 'accent'), (0.001, 0.003, 'accent')], segments=10, smooth=True)
    pad.rounded_box((-0.058, -0.012, 0.0445), (0.026, 0.008, 0.004), 'body', radius=0.001, segments=1)
    pad.rounded_box((-0.058, -0.012, 0.0465), (0.008, 0.026, 0.004), 'body', radius=0.001, segments=1)
    return pad

def build_tv(name='tv_a'):
    tv = HeroPart(name)
    tv.rounded_box((0, 0, 0.5), (1.45, 0.04, 0.84), 'body', radius=0.01, segments=1)
    tv.image_quad([(-0.7, 0.0225, 0.105), (0.7, 0.0225, 0.105), (0.7, 0.0225, 0.895), (-0.7, 0.0225, 0.895)], 'display')
    tv.rounded_box((0, 0, 0.04), (0.5, 0.22, 0.08), 'metal', radius=0.01, segments=1)
    tv.rounded_box((0, 0, 0.1), (0.2, 0.034, 0.12), 'metal', radius=0.006, segments=1)
    tv.rounded_box((0, 0.023, 0.09), (0.6, 0.006, 0.014), 'strip', radius=0.002, segments=1)
    return tv
