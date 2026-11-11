from hero_chair import build_base
from hero_kit import HeroPart

SEAT_ANCHOR = (0, -0.24, 0)
CHAIR_COLLISIONS = {
    'chair_a': ((0, 0.03, 0.665), (0.32, 0.33, 0.665)),
    'chair_b': ((0, 0.04, 0.61), (0.32, 0.34, 0.61)),
    'chair_c': ((0, 0.03, 0.45), (0.26, 0.31, 0.45)),
}

SEAT_CENTER = (0, -0.01, 0.385)
BACK_FOOT = 0.2
BACK_LEAN = 0.13
BACK_LOW = 0.5


def back_depth(z):
    return BACK_FOOT + BACK_LEAN * (z - BACK_LOW)


def spine(chair, top, radius=0.02):
    chair.tube([
        (0, 0.08, 0.352),
        (0, 0.25, 0.375),
        (0, back_depth(top) + 0.045, top),
    ], radius, 'metal', sides=6)


def mesh_back(chair):
    outline = [(-0.2, 0.5), (-0.235, 0.62), (-0.24, 0.8), (-0.215, 0.96), (-0.15, 1.03), (0.15, 1.03), (0.215, 0.96), (0.24, 0.8), (0.235, 0.62), (0.2, 0.5)]
    frame = [(x, back_depth(z), z) for x, z in outline]
    chair.tube(frame, 0.015, 'body', sides=6, closed=True)
    front = [(x * 0.97, back_depth(z) - 0.004, z) for x, z in outline]
    back = [(x * 0.97, back_depth(z) + 0.004, z) for x, z in outline]
    chair.poly(front, 'soft')
    chair.poly(back[::-1], 'soft')
    for z in (0.7, 0.82, 0.92):
        chair.rounded_box((0, back_depth(z) + 0.012, z), (0.42, 0.008, 0.012), 'body', radius=0.003, segments=1)
    chair.rounded_box((0, back_depth(0.6) - 0.02, 0.6), (0.34, 0.03, 0.09), 'top', radius=0.012, segments=2)
    chair.rounded_box((0, back_depth(0.535) - 0.02, 0.535), (0.3, 0.008, 0.006), 'strip', radius=0.002, segments=1)


def headrest(chair):
    chair.tube([
        (0, back_depth(1.0) + 0.03, 1.0),
        (0, back_depth(1.1) + 0.045, 1.1),
    ], 0.012, 'metal', sides=6)
    chair.rounded_box((0, back_depth(1.13) + 0.012, 1.13), (0.3, 0.055, 0.13), 'top', radius=0.022, segments=2)


def armrests(chair):
    for side in (-1, 1):
        x = side * 0.275
        chair.rounded_box((side * 0.255, 0.0, 0.385), (0.07, 0.07, 0.028), 'metal', radius=0.006, segments=1)
        chair.rounded_box((x, 0.0, 0.5), (0.03, 0.05, 0.21), 'metal', radius=0.008, segments=1)
        chair.rounded_box((x, -0.03, 0.618), (0.075, 0.25, 0.03), 'soft', radius=0.012, segments=2)


def build_chair_mesh(name='chair_b'):
    chair = HeroPart(name)
    chair.rounded_box(SEAT_CENTER, (0.5, 0.48, 0.05), 'top', radius=0.022, segments=3)
    chair.rounded_box((0, -0.235, 0.372), (0.4, 0.008, 0.006), 'strip', radius=0.002, segments=1)
    spine(chair, 0.62)
    mesh_back(chair)
    headrest(chair)
    armrests(chair)
    build_base(chair)
    return chair


def build_chair_task(name='chair_c'):
    chair = HeroPart(name)
    chair.rounded_box(SEAT_CENTER, (0.46, 0.45, 0.056), 'top', radius=0.026, segments=3)
    chair.rounded_box((0, -0.222, 0.37), (0.36, 0.008, 0.006), 'strip', radius=0.002, segments=1)
    spine(chair, 0.6, radius=0.018)
    chair.pillow((0, back_depth(0.7) + 0.01, 0.7), (0.42, 0.075, 0.34), 'top', puff=0.3, top_row='soft')
    chair.rounded_box((0, back_depth(0.7) + 0.052, 0.7), (0.2, 0.012, 0.12), 'metal', radius=0.005, segments=1)
    build_base(chair)
    return chair
