from hero_kit import HeroPart

CASE_COLLISIONS = {
    'case_a': ((0, 0, 0.29), (0.13, 0.235, 0.29)),
    'case_b': ((0, 0, 0.19), (0.155, 0.165, 0.19)),
    'case_c': ((0, 0, 0.23), (0.11, 0.24, 0.23)),
}

RACK_HALF_WIDTH = 0.15
RACK_HALF_DEPTH = 0.16
RACK_TOP = 0.3
SHELF_THICKNESS = 0.016
FOOT_HEIGHT = 0.012
MINI_HALF = 0.105
MINI_HEIGHT = 0.046


def rack(case):
    for x in (-RACK_HALF_WIDTH + 0.012, RACK_HALF_WIDTH - 0.012):
        for y in (-RACK_HALF_DEPTH + 0.012, RACK_HALF_DEPTH - 0.012):
            case.rounded_box((x, y, (RACK_TOP + FOOT_HEIGHT) / 2), (0.018, 0.018, RACK_TOP - FOOT_HEIGHT + 0.004), 'metal', radius=0.003, segments=1)
            case.rounded_box((x, y, FOOT_HEIGHT / 2), (0.03, 0.03, FOOT_HEIGHT), 'soft', radius=0.003, segments=1)
    case.slab(0, 0, RACK_HALF_WIDTH - 0.012, RACK_HALF_DEPTH - 0.012, 0.004, [
        (0.07, 0.003, 'body'),
        (0.073, 0.0, 'body'),
        (0.07 + SHELF_THICKNESS, 0.0, 'body'),
    ], corner=2)
    case.slab(0, 0, RACK_HALF_WIDTH, RACK_HALF_DEPTH, 0.016, [
        (RACK_TOP - 0.004, 0.006, 'strip'),
        (RACK_TOP, 0.0, 'top'),
        (RACK_TOP + SHELF_THICKNESS - 0.003, 0.0, 'top'),
        (RACK_TOP + SHELF_THICKNESS, 0.004, 'top'),
    ], corner=3)


def storage_box(case):
    base = 0.07 + SHELF_THICKNESS
    case.rounded_box((0, -0.01, base + 0.045), (0.2, 0.22, 0.09), 'body', radius=0.012, segments=2)
    front = 0.1 + 0.003
    case.rounded_box((0, front, base + 0.03), (0.15, 0.006, 0.006), 'strip', radius=0.002, segments=1)
    case.rounded_box((0.07, front, base + 0.062), (0.014, 0.006, 0.006), 'accent', radius=0.002, segments=1)


def mini_computer(case):
    base = RACK_TOP + SHELF_THICKNESS
    case.slab(0, 0, MINI_HALF, MINI_HALF, 0.034, [
        (base, 0.012, 'soft'),
        (base + 0.004, 0.008, 'strip'),
        (base + 0.008, 0.0, 'metal'),
        (base + MINI_HEIGHT - 0.004, 0.0, 'metal'),
        (base + MINI_HEIGHT, 0.004, 'metal'),
    ], corner=6)
    front = MINI_HALF + 0.003
    middle = base + MINI_HEIGHT / 2 + 0.002
    case.rounded_box((0.07, front, middle), (0.006, 0.006, 0.006), 'accent', radius=0.002, segments=1)
    for x in (-0.07, -0.045):
        case.rounded_box((x, front, middle), (0.016, 0.006, 0.007), 'soft', radius=0.002, segments=1)
    case.revolve((0, 0, base + MINI_HEIGHT - 0.002), 'z', [
        (0.03, 0.0, 'top'),
        (0.03, 0.004, 'top'),
        (0.026, 0.0055, 'top'),
        (0.001, 0.0055, 'top'),
    ], segments=24, smooth=True)


def build_case_b(name='case_b'):
    case = HeroPart(name)
    rack(case)
    storage_box(case)
    mini_computer(case)
    return case


TOWER_HALF_WIDTH = 0.105
TOWER_HALF_DEPTH = 0.22
TOWER_BASE = 0.022
TOWER_TOP = 0.45
SLAT_COUNT = 11
SLAT_PITCH = 0.016


def tower_shell(case):
    case.slab(0, 0, TOWER_HALF_WIDTH, TOWER_HALF_DEPTH, 0.016, [
        (TOWER_BASE, 0.005, 'body'),
        (TOWER_BASE + 0.005, 0.0, 'body'),
        (TOWER_TOP - 0.006, 0.0, 'body'),
        (TOWER_TOP, 0.006, 'body'),
    ], corner=3)
    for x in (-0.07, 0.07):
        case.rounded_box((x, 0, TOWER_BASE / 2 + 0.002), (0.03, 0.4, TOWER_BASE), 'metal', radius=0.005, segments=1)


def slatted_front(case):
    face = TOWER_HALF_DEPTH
    middle = (TOWER_BASE + TOWER_TOP) / 2
    case.rounded_box((0, face + 0.001, middle), (0.184, 0.006, 0.384), 'soft', radius=0.002, segments=1)
    first = -SLAT_PITCH * (SLAT_COUNT - 1) / 2
    for index in range(SLAT_COUNT):
        case.rounded_box((first + index * SLAT_PITCH, face + 0.008, middle + 0.012), (0.009, 0.012, 0.34), 'top', radius=0.003, segments=1)
    case.rounded_box((0, face + 0.007, TOWER_BASE + 0.03), (0.17, 0.008, 0.006), 'strip', radius=0.002, segments=1)


def top_panel(case):
    case.rounded_box((0, -0.03, TOWER_TOP + 0.001), (0.15, 0.27, 0.006), 'soft', radius=0.002, segments=1)
    front = TOWER_HALF_DEPTH - 0.03
    case.revolve((0.06, front, TOWER_TOP), 'z', [
        (0.013, 0.0, 'accent'),
        (0.013, 0.004, 'accent'),
        (0.0095, 0.004, 'metal'),
        (0.0095, 0.006, 'metal'),
        (0.001, 0.0065, 'metal'),
    ], segments=20, smooth=False)
    for x in (-0.06, -0.035, -0.01):
        case.rounded_box((x, front, TOWER_TOP + 0.001), (0.016, 0.008, 0.006), 'soft', radius=0.002, segments=1)


def side_light(case):
    for x in (-TOWER_HALF_WIDTH - 0.001, TOWER_HALF_WIDTH + 0.001):
        case.rounded_box((x, 0, TOWER_BASE + 0.03), (0.006, 0.38, 0.005), 'strip', radius=0.002, segments=1)


def build_case_c(name='case_c'):
    case = HeroPart(name)
    tower_shell(case)
    slatted_front(case)
    top_panel(case)
    side_light(case)
    return case
