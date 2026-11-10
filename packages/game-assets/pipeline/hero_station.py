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
    part.revolve(center, 'y', profile, segments=11, smooth=False)


def build_case(name='case_a'):
    case = HeroPart(name)
    case.slab(0, 0, 0.125, 0.23, 0.05, [
        (0.03, 0.008, 'strip'),
        (0.046, 0.0, 'top'),
        (0.532, 0.0, 'strip'),
        (0.545, 0.0, 'top'),
        (0.578, 0.0, 'top'),
        (0.586, 0.014, 'top'),
    ], corner=1)
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
        ], segments=9, smooth=False)
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


def build_keyboard(name='keyboard_a'):
    keyboard = HeroPart(name)
    keyboard.slab(0, 0, 0.222, 0.086, 0.014, [
        (0.0, 0.006, 'strip'),
        (0.009, 0.0, 'strip'),
        (0.015, 0.0, 'body'),
        (0.024, 0.0, 'soft'),
        (0.027, 0.005, 'soft'),
    ])
    rows = [13, 14, 14, 13, 12]
    pitch = 0.0255
    top = 0.0695
    left, span = -0.208, 0.416
    gap = 0.0042
    key_low, key_high = 0.026, 0.048
    for r, count in enumerate(rows):
        y1 = top - r * pitch
        width = span / count
        for c in range(count):
            u = 0.82 * (c + 0.5) / count + 0.18 * r / len(rows)
            keyboard.key(left + c * width, left + (c + 1) * width - gap, y1 - pitch + gap, y1, key_low, key_high, u)
    widths = [0.05, 0.05, 0.05, 0.13, 0.046, 0.046, 0.044]
    x0 = left
    y1 = top - len(rows) * pitch
    for i, width in enumerate(widths):
        keyboard.key(x0, x0 + width - gap, y1 - pitch + gap, y1, key_low, key_high, (i + 0.5) / len(widths))
        x0 += width
    return keyboard


MOUSE_LENGTH = 0.124
MOUSE_SEAM = 0.012
MOUSE_WIDTH = [(0.0, 0.011), (0.035, 0.017), (0.14, 0.025), (0.26, 0.029), (0.36, 0.0305), (0.46, 0.0315), (0.6, 0.0325), (0.76, 0.0305), (0.9, 0.025), (0.965, 0.019), (1.0, 0.012)]
MOUSE_HUMP = [(0.0, 0.004), (0.14, 0.012), (0.36, 0.02), (0.5, 0.0245), (0.64, 0.0265), (0.8, 0.023), (0.92, 0.014), (1.0, 0.006)]
MOUSE_STRIP_BOTTOM = 0.0105
MOUSE_U = [0.0, 0.035, 0.14, 0.26, 0.36, 0.46, 0.6, 0.76, 0.9, 0.965, 1.0]
MOUSE_V = [-1.0, -0.94, -0.7, -0.4, -0.12, -0.03, 0.03, 0.12, 0.4, 0.7, 0.94, 1.0]
MOUSE_GROOVE_ROWS = range(1, 4)
MOUSE_SLOT_ROW = 4
MOUSE_LOGO_ROW = 6


def mouse_y(u):
    return -MOUSE_LENGTH / 2 + u * MOUSE_LENGTH


def mouse_rise(u, v):
    return smooth_table(MOUSE_HUMP, u) * (1 - abs(v) ** 2.4) ** 0.6


def mouse_point(u, v):
    return Vector((v * smooth_table(MOUSE_WIDTH, u), mouse_y(u), MOUSE_SEAM + mouse_rise(u, v)))


def mouse_row(i, j):
    if j == 5 and i in MOUSE_GROOVE_ROWS:
        return 'soft'
    if j in (4, 5, 6) and i == MOUSE_SLOT_ROW:
        return 'soft'
    if j == 5 and i in (MOUSE_LOGO_ROW, MOUSE_LOGO_ROW + 1):
        return 'accent'
    return 'top'


def mouse_outline():
    rows = range(len(MOUSE_U))
    cols = range(len(MOUSE_V))
    path = [(0, j) for j in cols]
    path += [(i, cols[-1]) for i in rows[1:]]
    path += [(rows[-1], j) for j in reversed(cols[:-1])]
    path += [(i, 0) for i in reversed(rows[1:-1])]
    return [mouse_point(MOUSE_U[i], MOUSE_V[j]) for i, j in path]


def build_mouse(name='mouse_a'):
    mouse = HeroPart(name)
    cols = len(MOUSE_V)
    verts = [mouse_point(u, v) for u in MOUSE_U for v in MOUSE_V]
    faces, rows = [], []
    for i in range(len(MOUSE_U) - 1):
        for j in range(cols - 1):
            a = i * cols + j
            faces.append([a, a + 1, a + cols + 1, a + cols])
            rows.append(mouse_row(i, j))
    mouse.add_cage(verts, faces, rows, levels=1)

    outline = mouse_outline()
    centre = sum(outline, Vector()) / len(outline)
    def shell_ring(z, scale):
        return [Vector((centre.x + (p.x - centre.x) * scale, centre.y + (p.y - centre.y) * scale, z)) for p in outline]
    shell = [shell_ring(0.0, 0.93), shell_ring(0.003, 1.0), shell_ring(MOUSE_STRIP_BOTTOM, 1.0), shell_ring(MOUSE_SEAM, 1.0)]
    mouse.loft(shell, lambda r, c: 'strip' if r == 2 else 'body', levels=0, cap=False)
    mouse.poly([tuple(p) for p in reversed(ring(0.0, 0.93))], 'soft')

    wheel_u = (MOUSE_U[MOUSE_SLOT_ROW] + MOUSE_U[MOUSE_SLOT_ROW + 1]) / 2
    wheel_top = MOUSE_SEAM + mouse_rise(wheel_u, 0.0)
    mouse.revolve((0, mouse_y(wheel_u), wheel_top - 0.004), 'x', [
        (0.009, -0.003, 'screen'),
        (0.009, 0.003, 'screen'),
        (0.006, 0.003, 'metal'),
        (0.001, 0.003, 'metal'),
    ], segments=14)
    for u in (0.27, 0.37):
        x = 0.85 * smooth_table(MOUSE_WIDTH, u)
        z = MOUSE_SEAM + mouse_rise(u, 0.85)
        mouse.rounded_box((x, mouse_y(u), z), (0.004, 0.011, 0.0045), 'metal', radius=0.001, segments=1)
    return mouse


def build_headset(name='headset_a'):
    headset = HeroPart(name)
    headset.slab(0, 0, 0.082, 0.082, 0.03, [
        (0.0, 0.0, 'strip'),
        (0.009, 0.0, 'strip'),
        (0.014, 0.0, 'body'),
        (0.026, 0.01, 'top'),
        (0.028, 0.022, 'top'),
    ])
    headset.revolve((0, 0, 0.026), 'z', [(0.022, 0.0, 'body'), (0.015, 0.02, 'metal'), (0.012, 0.21, 'metal'), (0.012, 0.215, 'metal')], segments=10)
    headset.rounded_box((0, 0, 0.24), (0.1, 0.034, 0.024), 'body', radius=0.007, segments=1)
    center = Vector((0, 0, 0.165))
    radius = 0.105
    arc = [center + Vector((radius * math.cos(math.radians(a)), 0, radius * math.sin(math.radians(a)))) for a in range(-10, 191, 14)]
    headset.tube(arc, 0.014, 'trim', sides=6)
    inner = [center + Vector(((radius - 0.016) * math.cos(math.radians(a)), 0, (radius - 0.016) * math.sin(math.radians(a)))) for a in range(32, 149, 13)]
    headset.tube(inner, 0.012, 'soft', sides=6)
    for side in (-1, 1):
        x = side * 0.104
        profile = [
            (0.026, -0.016, 'soft'),
            (0.052, -0.016, 'soft'),
            (0.062, -0.002, 'soft'),
            (0.062, 0.012, 'body'),
            (0.06, 0.024, 'trim'),
            (0.056, 0.03, 'accent'),
            (0.044, 0.03, 'body'),
            (0.03, 0.033, 'strip'),
            (0.001, 0.033, 'body'),
        ]
        if side < 0:
            profile = [(r, -along, row) for r, along, row in reversed(profile)]
        headset.revolve((x, 0, 0.14), 'x', profile, segments=16)
        outer = x + side * 0.0345
        half = 0.02
        quad = [(outer, -half, 0.14 - half), (outer, half, 0.14 - half), (outer, half, 0.14 + half), (outer, -half, 0.14 + half)]
        headset.image_quad(quad if side > 0 else quad[::-1], 'decal')
    return headset


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
    ], segments=18)
    grille = [
        (0.03, 0.0, 'body'),
        (0.043, 0.012, 'body'),
        (0.043, 0.056, 'body'),
        (0.0445, 0.06, 'accent'),
        (0.0445, 0.067, 'accent'),
        (0.041, 0.071, 'trim'),
        (0.0425, 0.11, 'trim'),
        (0.0425, 0.15, 'trim'),
        (0.034, 0.176, 'trim'),
        (0.016, 0.19, 'trim'),
        (0.001, 0.193, 'trim'),
    ]
    mic.revolve((0, 0, 0.075), 'z', grille, segments=14)
    arc = [Vector((0.056 * math.cos(math.radians(a)), 0, 0.122 + 0.056 * math.sin(math.radians(a)))) for a in range(180, 361, 30)]
    mic.tube(arc, 0.0075, 'body', sides=6)
    for side in (-1, 1):
        profile = [(0.001, -0.01, 'metal'), (0.016, -0.01, 'metal'), (0.016, 0.01, 'metal'), (0.001, 0.01, 'metal')]
        mic.revolve((side * 0.05, 0, 0.122), 'x', profile, segments=10, smooth=False)
    mic.revolve((0, 0.0442, 0.102), 'y', [(0.019, 0.0, 'body'), (0.019, 0.003, 'screen'), (0.013, 0.003, 'body'), (0.001, 0.002, 'body')], segments=14, smooth=False)
    return mic


def build_speaker(name='speaker_a'):
    speaker = HeroPart(name)
    speaker.slab_y(0, 0.135, 0.076, 0.135, 0.02, [
        (-0.09, 0.008, 'metal'),
        (-0.08, 0.0, 'metal'),
        (0.06, 0.0, 'metal'),
        (0.072, 0.008, 'body'),
        (0.0725, 0.01, 'body'),
    ])
    for z, radius, ring in ((0.197, 0.04, 'accent'), (0.083, 0.064, 'screen')):
        speaker.revolve((0, 0.0725, z), 'y', [
            (radius, 0.0, 'body'),
            (radius, 0.005, ring),
            (radius * 0.84, 0.005, 'soft'),
            (radius * 0.4, -0.014, 'soft'),
            (radius * 0.36, -0.006, 'trim'),
            (0.001, 0.008, 'trim'),
        ], segments=20, smooth=False)
    return speaker


def build_mat(name='mat_a'):
    mat = HeroPart(name)
    mat.slab(0, 0, 0.425, 0.175, 0.024, [
        (0.0, 0.0, 'body'),
        (0.0035, 0.002, 'soft'),
    ])
    border = [(x, y, 0.0045) for x, y in rounded_rect(0, 0, 0.415, 0.165, 0.02, 3)]
    mat.tube(border, 0.007, 'strip', sides=4, closed=True)
    mat.image_quad([(0.325, -0.14, 0.0055), (0.395, -0.14, 0.0055), (0.395, -0.08, 0.0055), (0.325, -0.08, 0.0055)], 'decal')
    return mat
