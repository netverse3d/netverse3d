import math

from mathutils import Vector

from hero_kit import HeroPart

REACH = Vector((0.865, 0.502, 0.0))
SIDE = Vector((-0.502, 0.865, 0.0))
UP = Vector((0.0, 0.0, 1.0))
PIVOT_HEIGHT = 0.078
ELBOW = (-0.07, 0.56)
WRIST = (0.3, 0.36)
BAR_GAP = 0.021
BAR_HALF = 0.0085
MOUTH = Vector((0.62, 0.58, 0.34))


def in_plane(along, height):
    return REACH * along + UP * height


def turned(part, origin, axis, profile, segments=16, smooth=True):
    axis = Vector(axis).normalized()
    helper = UP if abs(axis.z) < 0.9 else Vector((1.0, 0.0, 0.0))
    first = helper.cross(axis).normalized()
    second = axis.cross(first).normalized()
    origin = Vector(origin)
    rings = [
        [
            origin + axis * along + (first * math.cos(2 * math.pi * i / segments) + second * math.sin(2 * math.pi * i / segments)) * radius
            for i in range(segments)
        ]
        for radius, along, _ in profile
    ]
    part.loft(rings, lambda r, c: profile[r][2], levels=0, smooth=smooth)


def hinge(part, centre, radius, half_width, row='metal'):
    turned(part, centre - SIDE * half_width, SIDE, [
        (radius * 0.55, 0.0, row),
        (radius, 0.003, row),
        (radius, half_width * 2 - 0.003, row),
        (radius * 0.55, half_width * 2, row),
    ], segments=16, smooth=True)


def bar_pair(part, start, end, row='body'):
    direction = (end - start).normalized()
    normal = SIDE.cross(direction).normalized()
    for sign in (-1, 1):
        offset = normal * (BAR_GAP * sign)
        part.tube([start + offset, end + offset], BAR_HALF, row, sides=4)
    for ratio in (0.18, 0.82):
        point = start.lerp(end, ratio)
        part.tube([point - normal * BAR_GAP, point + normal * BAR_GAP], BAR_HALF * 0.75, 'metal', sides=4)


def sagging_cable(part, start, end, sag, radius=0.0035, steps=9):
    points = []
    for step in range(steps + 1):
        ratio = step / steps
        point = start.lerp(end, ratio)
        point.z -= sag * 4 * ratio * (1 - ratio)
        points.append(point)
    part.tube(points, radius, 'body', sides=5)


def build_mic_boom(name='mic_b'):
    mic = HeroPart(name)
    mic.rounded_box((0.0, 0.0, 0.011), (0.086, 0.074, 0.022), 'body', radius=0.007, segments=2)
    mic.rounded_box((0.0, -0.046, 0.013), (0.05, 0.022, 0.026), 'metal', radius=0.004, segments=1)
    turned(mic, (0.0, 0.0, 0.022), UP, [
        (0.03, 0.0, 'strip'),
        (0.03, 0.005, 'strip'),
        (0.026, 0.008, 'metal'),
        (0.017, 0.012, 'metal'),
        (0.017, 0.04, 'metal'),
        (0.021, 0.044, 'body'),
        (0.021, 0.07, 'body'),
        (0.012, 0.074, 'body'),
    ], segments=16)

    pivot = in_plane(0.0, PIVOT_HEIGHT)
    elbow = in_plane(*ELBOW)
    wrist = in_plane(*WRIST)
    hinge(mic, pivot, 0.027, 0.03)
    hinge(mic, elbow, 0.03, 0.032)
    hinge(mic, wrist, 0.023, 0.026)
    turned(mic, elbow + SIDE * 0.028, SIDE, [(0.016, 0.0, 'accent'), (0.016, 0.004, 'accent'), (0.006, 0.006, 'body')], segments=12, smooth=False)

    bar_pair(mic, pivot, elbow)
    bar_pair(mic, elbow, wrist)

    body_centre = wrist - UP * 0.074
    aim = (MOUTH - body_centre).normalized()
    turned(mic, wrist - UP * 0.004, -UP, [
        (0.009, 0.0, 'metal'),
        (0.009, 0.02, 'metal'),
        (0.013, 0.024, 'metal'),
        (0.013, 0.03, 'metal'),
    ], segments=10)
    yoke_axis = aim.cross(UP).normalized()
    arc = []
    for step in range(9):
        angle = math.pi * step / 8
        arc.append(body_centre + (yoke_axis * math.cos(angle) + UP * math.sin(angle)) * 0.056)
    mic.tube(arc, 0.007, 'metal', sides=6)
    for sign in (-1, 1):
        turned(mic, body_centre + yoke_axis * (0.043 * sign), yoke_axis * sign, [
            (0.014, 0.0, 'metal'),
            (0.014, 0.017, 'metal'),
            (0.008, 0.02, 'accent'),
        ], segments=10, smooth=False)

    turned(mic, body_centre - aim * 0.1, aim, [
        (0.01, 0.0, 'metal'),
        (0.026, 0.003, 'metal'),
        (0.034, 0.012, 'body'),
        (0.041, 0.03, 'body'),
        (0.041, 0.112, 'body'),
        (0.0425, 0.115, 'accent'),
        (0.0425, 0.122, 'accent'),
        (0.041, 0.125, 'soft'),
        (0.045, 0.138, 'soft'),
        (0.0455, 0.2, 'soft'),
        (0.042, 0.219, 'soft'),
        (0.03, 0.233, 'soft'),
        (0.012, 0.24, 'soft'),
    ], segments=18)
    turned(mic, body_centre - aim * 0.058, aim, [
        (0.0418, 0.0, 'trim'),
        (0.0418, 0.007, 'trim'),
    ], segments=18)

    plug = body_centre - aim * 0.1
    under = SIDE.cross((wrist - elbow).normalized()).normalized() * (BAR_GAP + 0.016)
    sagging_cable(mic, plug, elbow.lerp(wrist, 0.55) - under, 0.012, steps=6)
    mic.tube([elbow.lerp(wrist, 0.55) - under, elbow.lerp(wrist, 0.08) - under], 0.0035, 'body', sides=5)
    sagging_cable(mic, elbow.lerp(wrist, 0.08) - under, pivot.lerp(elbow, 0.85) - REACH * 0.04, 0.01, steps=5)
    mic.tube([pivot.lerp(elbow, 0.85) - REACH * 0.04, pivot.lerp(elbow, 0.12) - REACH * 0.04], 0.0035, 'body', sides=5)
    return mic
