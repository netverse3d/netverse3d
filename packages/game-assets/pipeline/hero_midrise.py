from hero_kit import HeroPart
from hero_solid import rbox


def facade(name, row):
    part = HeroPart(name)
    rbox(part, (0, 0.16, 2), (4, 0.32, 4), row)
    return part


def build_apartment():
    part = facade('midrise_floor_a', 'wall')
    for x in (-0.93, 0.93):
        rbox(part, (x, -0.024, 2.23), (1.35, 0.055, 2.2), 'body', radius=0.025)
        rbox(part, (x, -0.060, 2.23), (1.20, 0.025, 2.04), 'screen' if x < 0 else 'soft')
    rbox(part, (0, -0.51, 0.86), (3.76, 1.04, 0.19), 'top', radius=0.04)
    rbox(part, (0, -1.03, 1.48), (3.76, 0.07, 0.07), 'metal')
    for x in (-1.79, -0.89, 0, 0.89, 1.79):
        rbox(part, (x, -1.03, 1.18), (0.055, 0.055, 0.62), 'metal')
    for x in (0.9, 1.12, 1.34, 1.56, 1.78):
        rbox(part, (x, -0.58, 2.68), (0.05, 0.79, 0.95), 'trim')
    return part


def build_office():
    part = facade('midrise_floor_b', 'wall')
    for z in (1.16, 2.51):
        rbox(part, (0, -0.08, z), (3.86, 0.16, 1.09), 'metal', radius=0.025)
        for index in range(4):
            x = (index - 1.5) * 0.93
            rbox(part, (x, -0.176, z), (0.86, 0.044, 0.93), 'screen' if index % 3 == 1 else 'soft')
        rbox(part, (0, -0.17, z + 0.57), (3.92, 0.34, 0.13), 'trim')
    return part


def build_shopfront():
    part = facade('midrise_ground_a', 'wall')
    rbox(part, (0, -0.05, 1.47), (3.5, 0.11, 2.92), 'metal')
    for x in (-1.12, 0, 1.12):
        rbox(part, (x, -0.138, 1.47), (1.02, 0.06, 2.74), 'screen' if x < 0 else 'soft')
    rbox(part, (0, -0.44, 3.2), (3.94, 0.9, 0.19), 'top', radius=0.03)
    rbox(part, (0, -0.904, 3.21), (3.82, 0.04, 0.10), 'strip')
    return part


def build_garage():
    part = facade('midrise_ground_b', 'wall')
    rbox(part, (0, -0.025, 1.18), (3.24, 0.075, 2.35), 'soft')
    part.prism_x([(-1.42, 0), (0, 0), (0, 0.37), (-1.42, 0.02)], -1.6, 1.6, 'floor')
    for x in (-1.76, 1.76):
        rbox(part, (x, -0.25, 1.25), (0.22, 0.50, 2.5), 'metal')
    rbox(part, (0, -0.36, 2.53), (3.56, 0.70, 0.21), 'trim')
    rbox(part, (0, -0.73, 2.54), (2.7, 0.045, 0.11), 'accent')
    return part


def build_roof(variant):
    part = HeroPart(f'midrise_roof_{variant}')
    rbox(part, (0, 0, 0.09), (4, 4, 0.18), 'top')
    if variant == 'a':
        part.revolve((-0.92, 0.4, 0), 'z', [(0.66, 0.20, 'metal'), (0.66, 1.34, 'metal'),
                                             (0.46, 1.47, 'trim')], segments=16)
        for x in (0.38, 1.34):
            rbox(part, (x, 0.1, 0.53), (0.72, 0.6, 0.7), 'body', radius=0.05)
            for z in (0.35, 0.52, 0.69):
                rbox(part, (x, -0.216, z), (0.53, 0.035, 0.045), 'metal')
    else:
        for x in (-1.4, 1.4):
            for y in (-1.23, 1.23):
                rbox(part, (x, y, 0.79), (0.08, 0.08, 1.22), 'metal')
        for y in (-1.2, 0, 1.2):
            part.tube([(-1.4, y, 1.41), (1.4, y, 1.41)], 0.022, 'metal', sides=4)
        rbox(part, (0.19, 0, 0.95), (0.68, 0.036, 0.88), 'trim')
    return part


def build_midrise_parts():
    return (build_apartment(), build_office(), build_shopfront(), build_garage(),
            build_roof('a'), build_roof('b'))
