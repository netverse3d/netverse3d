from hero_kit import HeroPart

CASE_COLLISIONS = {
    'case_a': ((0, 0, 0.29), (0.13, 0.235, 0.29)),
    'case_b': ((0, 0, 0.19), (0.155, 0.165, 0.19)),
    'case_c': ((0, 0, 0.225), (0.105, 0.235, 0.225)),
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


TOWER_HALF_WIDTH = 0.1
TOWER_HALF_DEPTH = 0.22
TOWER_TOP = 0.446
BEZEL_FRONT = TOWER_HALF_DEPTH + 0.012


def tower_shell(case):
    case.slab(0, 0, TOWER_HALF_WIDTH, TOWER_HALF_DEPTH, 0.01, [
        (0.016, 0.004, 'metal'),
        (0.02, 0.0, 'metal'),
        (TOWER_TOP - 0.006, 0.0, 'metal'),
        (TOWER_TOP, 0.006, 'metal'),
    ], corner=2)
    for y in (-0.17, 0.17):
        case.rounded_box((0, y, 0.008), (0.17, 0.05, 0.016), 'soft', radius=0.004, segments=1)
    case.rounded_box((0, TOWER_HALF_DEPTH + 0.005, 0.233), (0.196, 0.014, 0.416), 'top', radius=0.006, segments=2)


def drive_bays(case):
    face = BEZEL_FRONT + 0.002
    for z in (0.398, 0.35):
        case.rounded_box((0, face, z), (0.152, 0.006, 0.04), 'body', radius=0.002, segments=1)
        case.rounded_box((0.058, face + 0.004, z - 0.011), (0.016, 0.004, 0.006), 'metal', radius=0.001, segments=1)
    case.rounded_box((0, face, 0.296), (0.108, 0.006, 0.03), 'body', radius=0.002, segments=1)
    case.rounded_box((0, face + 0.004, 0.3), (0.082, 0.004, 0.005), 'soft', radius=0.001, segments=1)
    case.rounded_box((0.038, face + 0.004, 0.288), (0.014, 0.004, 0.006), 'metal', radius=0.001, segments=1)


def front_controls(case):
    face = BEZEL_FRONT
    case.revolve((0.056, face, 0.215), 'y', [
        (0.015, 0.0, 'body'),
        (0.015, 0.004, 'body'),
        (0.0115, 0.004, 'metal'),
        (0.0115, 0.007, 'metal'),
        (0.001, 0.0075, 'metal'),
    ], segments=20, smooth=False)
    for x, row in ((-0.06, 'accent'), (-0.038, 'screen')):
        case.rounded_box((x, face + 0.002, 0.215), (0.012, 0.006, 0.006), row, radius=0.002, segments=1)
    for z in (0.066, 0.086, 0.106, 0.126, 0.146):
        case.rounded_box((0, face + 0.002, z), (0.15, 0.006, 0.008), 'soft', radius=0.002, segments=1)
    case.rounded_box((0, face + 0.002, 0.04), (0.16, 0.006, 0.006), 'strip', radius=0.002, segments=1)


def side_vents(case):
    for x in (-TOWER_HALF_WIDTH - 0.002, TOWER_HALF_WIDTH + 0.002):
        for z in (0.1, 0.122, 0.144, 0.166, 0.188, 0.21):
            case.rounded_box((x, -0.06, z), (0.006, 0.16, 0.008), 'soft', radius=0.002, segments=1)


def build_case_c(name='case_c'):
    case = HeroPart(name)
    tower_shell(case)
    drive_bays(case)
    front_controls(case)
    side_vents(case)
    return case
