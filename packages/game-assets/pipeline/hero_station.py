import math

from mathutils import Vector

from hero_kit import HeroPart, rounded_rect, smooth_table


def desk_ring(inset):
    hw, hh = 0.75 - inset, 0.34 - inset
    corner = rounded_rect(0, -0.46, hw, hh, max(0.05 - inset, 0.002), 3)
    head = corner[:4]
    tail = corner[4:]
    front = head[-1][1]
    span = head[-1][0]
    notch = []
    for i in range(1, 12):
        x = span - 2 * span * i / 12
        depth = 0.05 * max(0.0, 1 - (x / 0.46) ** 2)
        notch.append((x, front - depth))
    return head + notch + tail


def build_desk(name='desk_a'):
    desk = HeroPart(name)
    layers = [
        (0.630, 0.014, 'body'),
        (0.637, 0.0, 'body'),
        (0.664, 0.0, 'strip'),
        (0.692, 0.0, 'strip'),
        (0.704, 0.013, 'top'),
        (0.7042, 0.018, 'top'),
    ]
    rings = [[Vector((x, y, z)) for x, y in desk_ring(inset)] for z, inset, _ in layers]
    desk.loft(rings, lambda r, c: layers[r][2], levels=0, smooth=False)
    outline = [(-0.78, 0.0), (-0.15, 0.0), (-0.105, 0.632), (-0.78, 0.632)]
    for side in (-1, 1):
        x0, x1 = sorted((side * 0.585, side * 0.725))
        desk.prism_x(outline, x0, x1, 'body')
        for x, normal in ((x0 - 0.002, -1), (x1 + 0.002, 1)):
            points = [(x, -0.72, 0.08), (x, -0.30, 0.08), (x, -0.25, 0.57), (x, -0.72, 0.57)]
            desk.poly(points if normal > 0 else points[::-1], 'soft')
            desk.tube([(x, -0.72, 0.08), (x, -0.30, 0.08), (x, -0.25, 0.57)], 0.0085, 'screen', sides=4)
            desk.tube([(x, -0.158, 0.02), (x, -0.112, 0.625)], 0.008, 'strip', sides=4)
        center = side * 0.655
        desk.tube([(center, -0.1435, 0.02), (center, -0.0975, 0.625)], 0.009, 'strip', sides=4)
    desk.rounded_box((0, -0.77, 0.34), (1.16, 0.03, 0.56), 'body', radius=0.006, segments=1)
    desk.tube([(-0.56, -0.752, 0.09), (0.56, -0.752, 0.09)], 0.006, 'accent', sides=4)
    desk.revolve((0.62, -0.70, 0.7047), 'z', [(0.052, 0.0, 'strip'), (0.052, 0.0035, 'strip'), (0.042, 0.0035, 'metal'), (0.034, 0.0015, 'soft'), (0.001, 0.0015, 'soft')], segments=16, smooth=False)
    return desk


def build_monitor(name='monitor_a'):
    monitor = HeroPart(name)
    monitor.slab_y(0, 0.345, 0.40, 0.24, 0.02, [
        (-0.04, 0.05, 'body'),
        (-0.024, 0.0, 'top'),
        (-0.002, 0.0, 'top'),
        (0.004, 0.002, 'top'),
    ])
    monitor.image_quad([(0.372, 0.006, 0.135), (-0.372, 0.006, 0.135), (-0.372, 0.006, 0.558), (0.372, 0.006, 0.558)], 'display')
    rim = [(x, 0.0048, z) for x, z in rounded_rect(0, 0.345, 0.397, 0.237, 0.018, 2)]
    monitor.tube(rim, 0.0018, 'accent', sides=3, closed=True)
    monitor.tube([(-0.05, 0.0055, 0.112), (0.05, 0.0055, 0.112)], 0.0022, 'accent', sides=3)
    monitor.rounded_box((0, -0.054, 0.335), (0.22, 0.03, 0.2), 'body', radius=0.012, segments=1)
    monitor.spoke((0, -0.06, 0.28), (0, -0.05, 0.02), 0.06, 0.07, 0.018, 0.022, 'metal', levels=0)
    monitor.slab(0, -0.03, 0.20, 0.12, 0.03, [
        (0.0, 0.0, 'strip'),
        (0.009, 0.0, 'strip'),
        (0.015, 0.0, 'body'),
        (0.03, 0.008, 'top'),
        (0.032, 0.02, 'top'),
    ])
    monitor.rounded_box((0, -0.008, 0.602), (0.10, 0.036, 0.038), 'body', radius=0.009, segments=1)
    monitor.revolve((0, 0.01, 0.602), 'y', [(0.016, 0.0, 'accent'), (0.016, 0.002, 'accent'), (0.01, 0.002, 'metal'), (0.001, 0.002, 'metal')], segments=12, smooth=False)
    return monitor


CURVE_RADIUS = 1.1


def curve_depth(x):
    return CURVE_RADIUS - math.sqrt(CURVE_RADIUS * CURVE_RADIUS - x * x)


def curve_stations(half_width, columns):
    return [-half_width + 2 * half_width * i / columns for i in range(columns + 1)]


def build_monitor_curved(name='monitor_b'):
    monitor = HeroPart(name)
    half_width, low, high, half_depth, columns = 0.45, 0.28, 0.665, 0.011, 14
    corner = 0.014
    inner = curve_stations(half_width - corner, columns)
    rings = []
    for x, trim in [(-half_width, corner)] + [(x, 0.0) for x in inner] + [(half_width, corner)]:
        y = curve_depth(x)
        rings.append([
            Vector((x, y + half_depth, high - trim)),
            Vector((x, y - half_depth, high - trim)),
            Vector((x, y - half_depth, low + trim)),
            Vector((x, y + half_depth, low + trim)),
        ])
    monitor.loft(rings, lambda r, c: 'body' if c == 1 else 'top', levels=0)
    screen = curve_stations(0.437, columns)
    face = half_depth + 0.002
    for i in range(columns):
        left, right = screen[columns - i], screen[columns - i - 1]
        monitor.image_rect([
            (left, curve_depth(left) + face, low + 0.026),
            (right, curve_depth(right) + face, low + 0.026),
            (right, curve_depth(right) + face, high - 0.012),
            (left, curve_depth(left) + face, high - 0.012),
        ], 'display', (i / columns, 0.0, (i + 1) / columns, 1.0))
    monitor.tube([(x, curve_depth(x) + face, low + 0.013) for x in curve_stations(0.07, 4)], 0.0022, 'accent', sides=3)
    monitor.tube([(x, curve_depth(x) - half_depth - 0.004, 0.47) for x in curve_stations(0.34, 10)], 0.005, 'strip', sides=4)
    monitor.rounded_box((0, -0.045, 0.47), (0.2, 0.05, 0.15), 'body', radius=0.014, segments=1)
    monitor.spoke((0, -0.06, 0.44), (0, -0.05, 0.03), 0.034, 0.044, 0.016, 0.02, 'metal', levels=0)
    hub = Vector((0, -0.05, 0))
    monitor.revolve(hub, 'z', [(0.045, 0.0, 'metal'), (0.045, 0.02, 'metal'), (0.036, 0.028, 'metal'), (0.001, 0.028, 'metal')], segments=14)
    for foot in ((0.25, 0.1), (-0.25, 0.1), (0.0, -0.15)):
        tip = Vector((foot[0], foot[1], 0))
        root = hub + (tip - hub).normalized() * 0.046
        monitor.spoke((root.x, root.y, 0.013), (tip.x, tip.y, 0.008), 0.022, 0.014, 0.013, 0.008, 'metal', levels=0)
    return monitor


def build_monitor_retro(name='monitor_c'):
    monitor = HeroPart(name)
    centre, half_width, half_height = 0.325, 0.29, 0.245
    monitor.slab_y(0, centre, half_width, half_height, 0.03, [
        (-0.19, 0.12, 'body'),
        (-0.145, 0.07, 'body'),
        (-0.05, 0.012, 'body'),
        (-0.012, 0.0, 'top'),
        (0.014, 0.0, 'top'),
        (0.02, 0.007, 'top'),
    ])
    glass_width, glass_low, glass_high = 0.232, centre - 0.148, centre + 0.2
    monitor.image_quad([
        (glass_width, 0.0225, glass_low),
        (-glass_width, 0.0225, glass_low),
        (-glass_width, 0.0225, glass_high),
        (glass_width, 0.0225, glass_high),
    ], 'display')
    lip = [(x, 0.023, z) for x, z in rounded_rect(0, (glass_low + glass_high) / 2, glass_width + 0.006, (glass_high - glass_low) / 2 + 0.006, 0.012, 2)]
    monitor.tube(lip, 0.005, 'soft', sides=4, closed=True)
    for x in (0.2, 0.16, 0.12):
        monitor.revolve((x, 0.02, centre - 0.196), 'y', [(0.011, 0.0, 'metal'), (0.011, 0.005, 'metal'), (0.001, 0.005, 'metal')], segments=8, smooth=False)
    monitor.revolve((-0.2, 0.02, centre - 0.196), 'y', [(0.007, 0.0, 'accent'), (0.007, 0.003, 'accent'), (0.001, 0.003, 'accent')], segments=8, smooth=False)
    for z in (centre + 0.05, centre + 0.015, centre - 0.02):
        monitor.tube([(-0.1, -0.1915, z), (0.1, -0.1915, z)], 0.004, 'soft', sides=3)
    monitor.revolve((0, -0.03, 0.0), 'z', [
        (0.14, 0.0, 'body'),
        (0.14, 0.012, 'body'),
        (0.12, 0.024, 'top'),
        (0.06, 0.03, 'top'),
        (0.05, 0.085, 'body'),
        (0.001, 0.085, 'body'),
    ], segments=18)
    return monitor


def fan(part, center, radius):
    profile = [
        (radius, 0.0, 'body'),
        (radius, 0.01, 'accent'),
        (radius * 0.76, 0.01, 'body'),
        (radius * 0.70, 0.002, 'screen'),
        (radius * 0.54, 0.002, 'soft'),
        (radius * 0.2, 0.002, 'top'),
        (0.001, 0.005, 'top'),
    ]
    part.revolve(center, 'y', profile, segments=20, smooth=False)


def build_case(name='case_a'):
    case = HeroPart(name)
    case.slab(0, 0, 0.125, 0.23, 0.05, [
        (0.03, 0.008, 'strip'),
        (0.046, 0.0, 'top'),
        (0.532, 0.0, 'strip'),
        (0.545, 0.0, 'top'),
        (0.578, 0.0, 'top'),
        (0.586, 0.014, 'top'),
    ], corner=3)
    case.poly([(0.082, 0.232, 0.06), (0.082, 0.232, 0.52), (-0.082, 0.232, 0.52), (-0.082, 0.232, 0.06)][::-1], 'soft')
    for z in (0.135, 0.29, 0.445):
        fan(case, (0, 0.2325, z), 0.076)
    case.tube([(0.094, 0.234, 0.05), (0.094, 0.234, 0.53), (-0.094, 0.234, 0.53), (-0.094, 0.234, 0.05), (0.094, 0.234, 0.05)], 0.0085, 'body', sides=4)
    x = 0.127
    case.poly([(x, -0.17, 0.075), (x, 0.17, 0.075), (x, 0.17, 0.525), (x, -0.17, 0.525)], 'soft')
    px = x + 0.0015
    case.tube([(px, -0.17, 0.075), (px, 0.17, 0.075), (px, 0.17, 0.525), (px, -0.17, 0.525), (px, -0.17, 0.075)], 0.0034, 'accent', sides=3)
    def side_fan(y, z, r, base=0.002):
        case.revolve((px + base, y, z), 'x', [
            (r, 0.0, 'body'),
            (r, 0.006, 'accent'),
            (r * 0.74, 0.006, 'body'),
            (r * 0.68, 0.002, 'screen'),
            (r * 0.42, 0.002, 'soft'),
            (0.001, 0.005, 'top'),
        ], segments=18, smooth=False)
    case.rounded_box((px, 0.0, 0.125), (0.006, 0.335, 0.09), 'top', radius=0.002, segments=1)
    case.tube([(px + 0.0035, -0.16, 0.172), (px + 0.0035, 0.16, 0.172)], 0.0034, 'strip', sides=3)
    case.rounded_box((px, 0.012, 0.262), (0.01, 0.275, 0.082), 'metal', radius=0.003, segments=1)
    case.tube([(px + 0.0055, -0.12, 0.218), (px + 0.0055, 0.145, 0.218)], 0.0034, 'screen', sides=3)
    side_fan(-0.06, 0.262, 0.032, base=0.005)
    side_fan(0.075, 0.262, 0.032, base=0.005)
    side_fan(-0.07, 0.42, 0.058)
    for y in (0.035, 0.06, 0.085, 0.11):
        case.rounded_box((px + 0.002, y, 0.42), (0.006, 0.014, 0.135), 'keycap', radius=0.001, segments=1)
    case.tube([(px + 0.003, -0.155, 0.09), (px + 0.003, -0.155, 0.51)], 0.0036, 'strip', sides=3)
    for y in (-0.17, 0.17):
        case.rounded_box((0, y, 0.016), (0.2, 0.06, 0.032), 'metal', radius=0.004, segments=1)
    return case


def build_mic(name='mic_a'):
    mic = HeroPart(name)
    mic.revolve((0, 0, 0), 'z', [
        (0.078, 0.0, 'strip'),
        (0.078, 0.006, 'strip'),
        (0.077, 0.009, 'body'),
        (0.064, 0.022, 'top'),
        (0.018, 0.026, 'metal'),
        (0.011, 0.04, 'metal'),
        (0.011, 0.08, 'metal'),
    ], segments=32)
    grille = [
        (0.03, 0.0, 'body'),
        (0.043, 0.012, 'body'),
        (0.043, 0.056, 'body'),
        (0.0445, 0.06, 'accent'),
        (0.0445, 0.067, 'accent'),
        (0.041, 0.071, 'trim'),
        (0.0425, 0.11, 'trim'),
        (0.0425, 0.15, 'trim'),
        (0.0405, 0.163, 'trim'),
        (0.0345, 0.176, 'trim'),
        (0.0255, 0.186, 'trim'),
        (0.014, 0.1915, 'trim'),
        (0.001, 0.193, 'trim'),
    ]
    mic.revolve((0, 0, 0.075), 'z', grille, segments=28)
    arc = [Vector((0.056 * math.cos(math.radians(a)), 0, 0.122 + 0.056 * math.sin(math.radians(a)))) for a in range(180, 361, 18)]
    mic.tube(arc, 0.0075, 'body', sides=10)
    for side in (-1, 1):
        profile = [(0.001, -0.01, 'metal'), (0.016, -0.01, 'metal'), (0.016, 0.01, 'metal'), (0.001, 0.01, 'metal')]
        mic.revolve((side * 0.05, 0, 0.122), 'x', profile, segments=18, smooth=False)
    mic.revolve((0, 0.0442, 0.102), 'y', [(0.019, 0.0, 'body'), (0.019, 0.003, 'screen'), (0.013, 0.003, 'body'), (0.001, 0.002, 'body')], segments=24, smooth=False)
    return mic
