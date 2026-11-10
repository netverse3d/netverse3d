from mathutils import Vector

from hero_chair import cylinder
from hero_kit import HeroPart
from hero_station import desk_ring

TOP = 0.704
FRONT = -0.12
BACK = -0.80


def grommet(desk, x, y):
    desk.revolve((x, y, TOP + 0.0007), 'z', [(0.052, 0.0, 'strip'), (0.052, 0.0035, 'strip'), (0.042, 0.0035, 'metal'), (0.034, 0.0015, 'soft'), (0.001, 0.0015, 'soft')], segments=16, smooth=False)


def front_led(desk, points, z):
    desk.tube([(x, y - 0.012, z) for x, y in points], 0.0045, 'strip', sides=4)


def build_desk_a(name='desk_a'):
    desk = HeroPart(name)
    layers = [
        (0.666, 0.014, 'body'),
        (0.672, 0.0, 'body'),
        (0.698, 0.0, 'body'),
        (TOP, 0.012, 'top'),
        (TOP + 0.0002, 0.018, 'top'),
    ]
    rings = [[Vector((x, y, z)) for x, y in desk_ring(inset)] for z, inset, _ in layers]
    desk.loft(rings, lambda r, c: layers[r][2], levels=0, smooth=False)
    front_led(desk, desk_ring(0.0)[4:15], 0.660)
    outline = [(-0.78, 0.0), (-0.16, 0.0), (-0.11, 0.666), (-0.78, 0.666)]
    for side in (-1, 1):
        x0, x1 = sorted((side * 0.60, side * 0.70))
        desk.prism_x(outline, x0, x1, 'body')
        for x, normal in ((x0 - 0.002, -1), (x1 + 0.002, 1)):
            points = [(x, -0.72, 0.08), (x, -0.31, 0.08), (x, -0.26, 0.60), (x, -0.72, 0.60)]
            desk.poly(points if normal > 0 else points[::-1], 'soft')
            desk.tube([(x, -0.72, 0.08), (x, -0.31, 0.08), (x, -0.26, 0.60)], 0.0085, 'screen', sides=4)
            desk.tube([(x, -0.166, 0.02), (x, -0.118, 0.655)], 0.008, 'strip', sides=4)
    desk.rounded_box((0, -0.77, 0.36), (1.18, 0.03, 0.6), 'body', radius=0.006, segments=1)
    desk.rounded_box((0, -0.70, 0.635), (0.9, 0.12, 0.05), 'metal', radius=0.006, segments=1)
    desk.tube([(-0.57, -0.752, 0.09), (0.57, -0.752, 0.09)], 0.006, 'accent', sides=4)
    grommet(desk, 0.62, -0.70)
    return desk


def build_desk_b(name='desk_b'):
    desk = HeroPart(name)
    desk.slab(0, -0.46, 0.75, 0.34, 0.05, [
        (0.674, 0.012, 'body'),
        (0.680, 0.0, 'body'),
        (0.698, 0.0, 'body'),
        (TOP, 0.01, 'top'),
        (TOP + 0.0002, 0.016, 'top'),
    ])
    for x in (-0.66, 0.66):
        for y in (-0.76, -0.16):
            cylinder(desk, (x, y), 0.022, 0.03, 0.68, 'metal', segments=12)
            desk.revolve((x, y, 0.0), 'z', [(0.032, 0.0, 'body'), (0.032, 0.02, 'accent'), (0.025, 0.03, 'body'), (0.001, 0.03, 'body')], segments=14, smooth=False)
        desk.tube([(x, -0.76, 0.12), (x, -0.16, 0.12)], 0.01, 'metal', sides=6)
    desk.tube([(-0.66, -0.76, 0.16), (0.66, -0.76, 0.16)], 0.012, 'metal', sides=6)
    desk.rounded_box((0, -0.70, 0.655), (1.0, 0.14, 0.05), 'body', radius=0.006, segments=1)
    desk.tube([(-0.6, -0.14, 0.668), (0.6, -0.14, 0.668)], 0.004, 'strip', sides=4)
    desk.tube([(-0.5, -0.78, 0.668), (0.5, -0.78, 0.668)], 0.004, 'strip', sides=4)
    grommet(desk, -0.62, -0.70)
    return desk


def build_desk_c(name='desk_c'):
    desk = HeroPart(name)
    desk.slab(0, -0.47, 0.78, 0.35, 0.03, [
        (0.664, 0.02, 'body'),
        (0.672, 0.004, 'body'),
        (0.684, 0.0, 'body'),
        (0.696, 0.0, 'body'),
        (TOP, 0.006, 'top'),
        (TOP + 0.0002, 0.012, 'top'),
    ])
    desk.rounded_box((0.52, -0.46, 0.335), (0.42, 0.6, 0.67), 'body', radius=0.008, segments=1)
    for z in (0.12, 0.33, 0.54):
        desk.rounded_box((0.52, -0.148, z), (0.36, 0.016, 0.17), 'body', radius=0.005, segments=1)
        desk.tube([(0.40, -0.136, z + 0.05), (0.64, -0.136, z + 0.05)], 0.005, 'metal', sides=4)
        desk.tube([(0.36, -0.1385, z - 0.085), (0.68, -0.1385, z - 0.085)], 0.003, 'strip', sides=4)
    desk.tube([(0.732, -0.2, 0.05), (0.732, -0.2, 0.62)], 0.004, 'accent', sides=4)
    outline = [(-0.78, 0.0), (-0.14, 0.0), (-0.14, 0.67), (-0.78, 0.67)]
    desk.prism_x(outline, -0.72, -0.62, 'body')
    desk.tube([(-0.722, -0.3, 0.05), (-0.722, -0.3, 0.62)], 0.007, 'strip', sides=4)
    desk.rounded_box((-0.14, -0.775, 0.36), (0.96, 0.025, 0.58), 'body', radius=0.006, segments=1)
    desk.tube([(-0.6, -0.76, 0.1), (0.3, -0.76, 0.1)], 0.005, 'screen', sides=4)
    desk.tube([(-0.72, -0.14, 0.661), (0.74, -0.14, 0.661)], 0.004, 'strip', sides=4)
    grommet(desk, -0.5, -0.72)
    return desk
