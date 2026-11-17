import math

import bmesh
from mathutils import Vector

from hero_kit import ALL_ROWS, HeroPart, rounded_rect


def remove_hidden_face(part, new_faces, axis, position, normal):
    hidden = []
    for face in new_faces:
        face.normal_update()
        if abs(face.calc_center_median()[axis] - position) < 1e-5 and face.normal[axis] * normal > 0.99:
            hidden.append(face)
    if hidden:
        bmesh.ops.delete(part.bm, geom=hidden, context='FACES')


def orient_shells(part):
    unseen = set(part.bm.faces)
    while unseen:
        pending = [unseen.pop()]
        island = set(pending)
        while pending:
            face = pending.pop()
            for edge in face.edges:
                for linked in edge.link_faces:
                    if linked in unseen:
                        unseen.remove(linked)
                        island.add(linked)
                        pending.append(linked)
        if all(len(edge.link_faces) == 2 for face in island for edge in face.edges):
            for face in island:
                face.normal_update()
            if sum(face.calc_center_median().dot(face.normal) * face.calc_area() for face in island) < 0:
                bmesh.ops.reverse_faces(part.bm, faces=list(island))


def cart_wheels(part):
    for sign in (-1, 1):
        x = sign * 0.66
        center = Vector((x, 0.13, 0.27))
        for profile, row in (
            ([(0.19, -0.018), (0.235, -0.023), (0.27, 0), (0.235, 0.023), (0.19, 0.018), (0.19, -0.018)], 'soft'),
            ([(0.172, -0.014), (0.205, -0.014), (0.205, 0.014), (0.172, 0.014), (0.172, -0.014)], 'metal'),
        ):
            rings = [[center + Vector((along, radius * math.cos(2 * math.pi * side / 16), radius * math.sin(2 * math.pi * side / 16))) for side in range(16)] for radius, along in profile]
            part.loft(rings, lambda r, c: row, levels=0, cap=False, smooth=True)
        for side in range(12):
            angle = 2 * math.pi * side / 12
            radial = Vector((0, math.cos(angle), math.sin(angle)))
            tangent = Vector((0, -math.sin(angle), math.cos(angle)))
            inner = center + radial * 0.038
            outer = center + radial * 0.188
            width = 0.006
            face = [inner - tangent * width, outer - tangent * width, outer + tangent * width, inner + tangent * width]
            part.oriented_poly(face, (sign, 0, 0), 'metal')
        part.revolve((x + sign * 0.006, 0.13, 0.27), 'x', [(0.055, -0.012, 'metal'), (0.055, 0.012, 'metal')], segments=16, smooth=True)
    part.tube([(0, 0.28, 0.5), (0, 0.34, 0.02)], 0.022, 'metal', sides=4)
    part.rounded_box((0, 0.34, 0.0175), (0.16, 0.1, 0.035), 'soft', radius=0.008, segments=1)


def cart_chassis(part):
    cart_wheels(part)
    part.rounded_box((0, 0.05, 0.53), (1.25, 0.67, 0.14), 'metal', radius=0.025, segments=1)
    part.rounded_box((0, -0.235, 0.76), (1.17, 0.045, 0.3), 'body', radius=0.012, segments=1)
    for x in (-0.31, 0.31):
        part.rounded_box((x, -0.262, 0.76), (0.43, 0.012, 0.23), 'metal', radius=0.005, segments=1)
        part.tube([(x - 0.19, -0.27, 0.665), (x - 0.19, -0.27, 0.855), (x + 0.19, -0.27, 0.855), (x + 0.19, -0.27, 0.665)], 0.003, 'body', sides=3)
    part.tube([(-0.52, -0.26, 0.61), (0.52, -0.26, 0.61)], 0.01, 'metal', sides=4)
    for x in (-0.56, 0.56):
        for z in (0.69, 0.84):
            part.tube([(x, -0.263, z - 0.017), (x, -0.263, z + 0.017)], 0.006, 'metal', sides=3)
    part.tube([(-0.12, -0.274, 0.77), (0.12, -0.274, 0.77)], 0.012, 'metal', sides=4)
    part.tube([(-0.6, -0.303, 0.912), (0.6, -0.303, 0.912)], 0.005, 'strip', sides=4)
    for x in (-0.54, 0.54):
        part.tube([(x, 0.32, 0.48), (x, 0.32, 0.93)], 0.021, 'metal', sides=4)
    part.tube([(-0.54, 0.32, 0.92), (0.54, 0.32, 0.92)], 0.025, 'metal', sides=4)


def roof_sign(part, z=1.91, y=-0.02):
    part.rounded_box((0, y, z), (1.14, 0.13, 0.32), 'metal', radius=0.022, segments=1)
    before = set(part.bm.faces)
    part.rounded_box((0, y - 0.071, z), (1.07, 0.012, 0.27), 'body', radius=0.004, segments=1)
    remove_hidden_face(part, set(part.bm.faces) - before, 1, y - 0.065, 1)
    part.image_rect([(-0.48, y - 0.0785, z - 0.12), (0.48, y - 0.0785, z - 0.12), (0.48, y - 0.0785, z + 0.12), (-0.48, y - 0.0785, z + 0.12)], 'decal', (0, 0, 1, 1))
    part.tube([(-0.51, y - 0.08, z - 0.14), (0.51, y - 0.08, z - 0.14), (0.51, y - 0.08, z + 0.14), (-0.51, y - 0.08, z + 0.14)], 0.009, 'strip', sides=4, closed=True)


def baguette(part, x, y, z, yaw):
    sides = 10
    profile = ((-0.5, 0.014), (-0.39, 0.033), (-0.30, 0.040), (-0.15, 0.043), (0, 0.043), (0.15, 0.043), (0.30, 0.040), (0.39, 0.033), (0.5, 0.014))
    vertices = []
    for ring, (along, radius) in enumerate(profile):
        for side in range(sides):
            angle = 2 * math.pi * side / sides
            across = radius * math.cos(angle)
            split = max(0.0, min(1.0, (0.36 - abs(along)) / 0.11))
            height = radius * 0.82 * max(math.sin(angle), -0.83)
            if side == 2:
                across -= 0.007 * split
                height += 0.005 * split
            elif side == 3:
                across += 0.009 * split
                height -= 0.011 * split
            elif side == 4:
                across += 0.020 * split
                height += 0.001 * split
            length_offset = along * 0.25
            bend = 0.004 * (1 - 4 * along * along)
            vertices.append((x + length_offset * math.cos(yaw) - (across + bend) * math.sin(yaw), y + length_offset * math.sin(yaw) + (across + bend) * math.cos(yaw), z + height))
    faces = []
    rows = []
    for ring in range(len(profile) - 1):
        for side in range(sides):
            next_side = (side + 1) % sides
            faces.append((ring * sides + side, ring * sides + next_side, (ring + 1) * sides + next_side, (ring + 1) * sides + side))
            rows.append('screen' if 1 <= ring <= 6 and side in (2, 3) else 'trim')
    faces.extend((tuple(reversed(range(sides))), tuple((len(profile) - 1) * sides + side for side in range(sides))))
    rows.extend(('trim', 'trim'))
    before = set(part.bm.faces)
    part.add_cage(vertices, faces, rows, levels=0, smooth=True)
    for face in set(part.bm.faces) - before:
        row = ALL_ROWS[face[part.row_layer]]
        if row == 'screen':
            part._tag((face,), 'screen', key_u=0.0, smooth=False)
        else:
            height = face.calc_center_median().z - z
            key_u = 0.02 if height < -0.012 else 0.25 if height > 0.021 and face.calc_center_median().y > y else 0.04
            part._tag((face,), 'trim', key_u=key_u, smooth=True)

def glass_panel(part, axis, center, size):
    rings = []
    for along, inset in ((-size[2] / 2, 0.002), (-size[2] / 2 + 0.002, 0), (size[2] / 2 - 0.002, 0), (size[2] / 2, 0.002)):
        half_u = size[0] / 2 - inset
        half_v = size[1] / 2 - inset
        outline = [(-half_u, -half_v), (half_u, -half_v), (half_u, half_v), (-half_u, half_v)]
        if axis == 'y':
            outline.reverse()
        if axis == 'z':
            rings.append([(center[0] + u, center[1] + v, center[2] + along) for u, v in outline])
        elif axis == 'y':
            rings.append([(center[0] + u, center[1] + along, center[2] + v) for u, v in outline])
        else:
            rings.append([(center[0] + along, center[1] + u, center[2] + v) for u, v in outline])
    part.loft(rings, lambda r, c: 'body', levels=0, smooth=False)


def build_cart_a():
    cart = HeroPart('cart_a')
    kiosk_body(cart)
    box_solid(cart, (-0.16, -0.06, 1.006), (0.76, 0.30, 0.012), 'metal', omit_bottom=True)
    for x in (-0.40, -0.16, 0.08):
        baguette(cart, x, -0.06, 1.041, math.pi / 2)
    for x, yaw in ((-0.34, 0.18), (0.0, -0.16)):
        baguette(cart, x, -0.06, 1.102, yaw)
    for x in (-0.55, 0.23):
        for y in (-0.22, 0.13):
            cart.tube([(x, y, 0.985), (x, y, 1.47)], 0.01, 'metal', sides=4)
    for z in (0.985, 1.47):
        cart.tube([(-0.55, -0.22, z), (0.23, -0.22, z), (0.23, 0.13, z), (-0.55, 0.13, z)], 0.009, 'metal', sides=4, closed=True)
    pane_reflections(cart, 'y', -0.22, -0.54, 0.22, 1.0, 1.46, -1)
    for x, side in ((-0.55, -1), (0.23, 1)):
        pane_reflections(cart, 'x', x, -0.21, 0.12, 1.0, 1.46, side)
    box_solid(cart, (-0.16, -0.045, 1.477), (0.80, 0.37, 0.014), 'metal')
    for x0, x1, y in ((-0.54, -0.13, 0.137), (-0.41, 0.0, 0.125)):
        flat_frame(cart, x0, x1, y, 1.0, 1.46, 0.01)
        pane_reflections(cart, 'y', y, x0 + 0.01, x1 - 0.01, 1.01, 1.45, 1)
    charcoal_grill(cart)
    cart.revolve((-0.48, 0.26, 0.986), 'z', [(0.045, 0, 'body'), (0.055, 0.08, 'body'), (0.03, 0.10, 'metal')], segments=8, smooth=False)
    cart.tube([(-0.48, 0.26, 1.09), (-0.47, 0.32, 1.12), (-0.38, 0.32, 1.12)], 0.004, 'soft', sides=4)
    for level in range(3):
        box_solid(cart, (-0.24, 0.265, 0.994 + 0.017 * level), (0.14 - 0.012 * level, 0.11 - 0.012 * level, 0.018), 'top', omit_bottom=True)
    for x in (-0.03, 0.04):
        cart.revolve((x, 0.27, 0.986), 'z', [(0.022, 0, 'body'), (0.022, 0.082, 'body'), (0.016, 0.089, 'top')], segments=6, smooth=False)
    box_solid(cart, (0.22, 0.27, 0.995), (0.19, 0.10, 0.02), 'top', omit_bottom=True)
    bmesh.ops.remove_doubles(cart.bm, verts=cart.bm.verts[:], dist=1e-6)
    return cart


def charcoal_grill(part):
    for x in (0.29, 0.59):
        box_solid(part, (x, -0.09, 0.998), (0.025, 0.13, 0.025), 'metal')
    box_solid(part, (0.44, -0.09, 1.028), (0.34, 0.19, 0.045), 'soft')
    for sign in (-1, 1):
        x = 0.44 + sign * 0.178
        part.oriented_poly([(x, -0.197, 1.018), (x, 0.017, 1.018), (x + sign * 0.012, 0.023, 1.101), (x + sign * 0.012, -0.203, 1.101)], (sign, 0, 0), 'metal')
        part.tube([(x + sign * 0.01, -0.15, 1.072), (x + sign * 0.047, -0.15, 1.072), (x + sign * 0.047, -0.03, 1.072), (x + sign * 0.01, -0.03, 1.072)], 0.005, 'metal', sides=3)
    for sign in (-1, 1):
        y = -0.09 + sign * 0.103
        part.oriented_poly([(0.267, y, 1.018), (0.613, y, 1.018), (0.632, y + sign * 0.008, 1.101), (0.248, y + sign * 0.008, 1.101)], (0, sign, 0), 'metal')
    box_solid(part, (0.44, -0.09, 1.068), (0.29, 0.15, 0.006), 'strip', omit_bottom=True)
    for x, y in ((0.32, -0.13), (0.40, -0.055), (0.49, -0.14), (0.56, -0.06)):
        part.revolve((x, y, 1.073), 'z', [(0.017, 0, 'soft'), (0.022, 0.011, 'top'), (0.009, 0.019, 'soft')], segments=4, smooth=False)
    part.tube([(0.25, -0.194, 1.104), (0.63, -0.194, 1.104), (0.63, 0.014, 1.104), (0.25, 0.014, 1.104)], 0.006, 'metal', sides=3, closed=True)
    for index in range(9):
        y = -0.178 + index * 0.022
        part.tube([(0.258, y, 1.106), (0.622, y, 1.106)], 0.0025, 'metal', sides=3)
    for index in range(3):
        x = 0.34 + index * 0.09
        y = -0.17 + index * 0.012
        part.tube([(x - 0.02, y - 0.055, 1.119), (x + 0.025, y + 0.095, 1.119)], 0.0025, 'metal', sides=3)
        part.revolve((x, y + 0.02, 1.127), 'z', [(0.018, -0.006, 'top'), (0.020, 0, 'trim'), (0.013, 0.008, 'top')], segments=4, smooth=False)

def box_solid(part, center, size, row, omit_top=False, omit_bottom=False):
    cx, cy, cz = center
    hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
    verts = [
        (cx - hx, cy - hy, cz - hz), (cx + hx, cy - hy, cz - hz), (cx + hx, cy + hy, cz - hz), (cx - hx, cy + hy, cz - hz),
        (cx - hx, cy - hy, cz + hz), (cx + hx, cy - hy, cz + hz), (cx + hx, cy + hy, cz + hz), (cx - hx, cy + hy, cz + hz),
    ]
    faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [3, 0, 4, 7], [1, 2, 6, 5]]
    if omit_bottom:
        faces.pop(0)
    if omit_top:
        faces.pop(0 if omit_bottom else 1)
    part.add_cage(verts, faces, [row] * len(faces), levels=0, smooth=False)


def ribbed_roof(part):
    ribs = 7
    base_width = 0.10
    top_width = 0.05
    margin = 0.1125
    gap = (1.6 - 2 * margin - ribs * base_width) / (ribs - 1)
    rib_half = (base_width - top_width) / 2
    profile = [(-0.8, 0)]
    for index in range(ribs):
        start = -0.8 + margin + index * (base_width + gap)
        if index:
            middle = (profile[-1][0] + start) / 2
            profile.extend(((middle - 0.012, 0), (middle - 0.006, -0.006), (middle + 0.006, -0.006), (middle + 0.012, 0)))
        profile.extend(((start, 0), (start + rib_half, 0.035), (start + rib_half + top_width, 0.035), (start + base_width, 0)))
    profile.append((0.8, 0))
    rings = []
    for y in (-0.425, 0.425):
        base = 2.085 - (y + 0.425) / 0.85 * 0.035
        rings.append([(x, y, base + lift) for x, lift in profile])
    part.loft(rings, lambda r, c: 'wall', levels=0, closed=False, cap=False, smooth=False)
    fold = [(-0.8, -0.426, 2.048), (0.8, -0.426, 2.048)]
    fold.extend((x, -0.426, 2.085 + lift) for x, lift in reversed(profile))
    part.add_cage(fold, [list(range(len(fold)))], ['metal'], levels=0, smooth=False)


def scalloped_hem(part):
    top = 1.815
    outline = [(0.55, top)]
    for index in reversed(range(10)):
        cx = -0.55 + 0.11 * (index + 0.5)
        for step in range(1, 5):
            angle = math.pi * step / 5
            outline.append((cx + 0.055 * math.cos(angle), top - 0.055 * math.sin(angle)))
        outline.append((cx - 0.055, top))
    part.loft([[(x, -0.3785, z) for x, z in outline], [(x, -0.3735, z) for x, z in outline]], lambda r, c: 'soft', levels=0, cap=True, smooth=False)


def arch_fender(part, center, wheel_y):
    rings = []
    for step in range(14):
        angle = math.radians(12 + 156 * step / 13)
        cos, sin = math.cos(angle), math.sin(angle)
        outer = (center[0] + 0.303 * cos, center[2] + 0.303 * sin)
        inner = (center[0] + 0.281 * cos, center[2] + 0.281 * sin)
        rings.append([
            (outer[0], wheel_y - 0.046, outer[1]),
            (outer[0], wheel_y + 0.046, outer[1]),
            (inner[0], wheel_y + math.copysign(0.046, wheel_y), inner[1]),
        ])
    part.loft(rings, lambda r, c: 'metal', levels=0, closed=False, cap=False, smooth=False)


def flat_frame(part, x0, x1, y, z0, z1, width):
    for left, right, bottom, top in (
        (x0, x1, z0, z0 + width),
        (x0, x1, z1 - width, z1),
        (x0, x0 + width, z0 + width, z1 - width),
        (x1 - width, x1, z0 + width, z1 - width),
    ):
        part.oriented_poly([(left, y, bottom), (right, y, bottom), (right, y, top), (left, y, top)], (0, 1, 0), 'metal')


def pane_reflections(part, axis, fixed, u0, u1, z0, z1, outward):
    def point(u, z, offset):
        if axis == 'y':
            return (u, fixed + outward * offset, z)
        return (fixed + outward * offset, u, z)

    normal = (0, outward, 0) if axis == 'y' else (outward, 0, 0)
    edge = 0.006
    for left, right, bottom, top in (
        (u0, u1, z0, z0 + edge),
        (u0, u1, z1 - edge, z1),
        (u0, u0 + edge, z0 + edge, z1 - edge),
        (u1 - edge, u1, z0 + edge, z1 - edge),
    ):
        part.oriented_poly([point(left, bottom, 0.003), point(right, bottom, 0.003), point(right, top, 0.003), point(left, top, 0.003)], normal, 'trim')
    width = u1 - u0
    height = z1 - z0
    for start, end, thickness in ((0.58, 0.38, 0.007), (0.69, 0.27, 0.004)):
        bottom = z0 + height * start
        top = z0 + height - edge
        finish = u0 + width * end
        part.oriented_poly([
            point(u0 + edge, bottom, 0.006),
            point(u0 + edge, bottom + thickness, 0.006),
            point(finish, top, 0.006),
            point(finish - thickness, top, 0.006),
        ], normal, 'trim')


def kiosk_wheels(part):
    segments = 16
    tyre = ((0.173, -0.029), (0.239, -0.031), (0.260, -0.013), (0.260, 0.013), (0.239, 0.031), (0.173, 0.029))
    for wheel_y in (-0.345, 0.345):
        center = Vector((-0.47, wheel_y, 0.255))
        out = math.copysign(1.0, wheel_y)

        def ring(radius, along):
            return [
                (center.x + radius * math.cos(-math.pi / 2 + math.pi / segments + 2 * math.pi * side / segments), wheel_y + along, center.z + radius * math.sin(-math.pi / 2 + math.pi / segments + 2 * math.pi * side / segments))
                for side in range(segments)
            ]

        part.loft([ring(radius, along) for radius, along in tyre], lambda r, c: 'soft', levels=0, cap=False, smooth=True)
        part.loft([ring(radius, out * offset) for radius, offset in ((0.169, 0.030), (0.146, 0.019))], lambda r, c: 'metal', levels=0, cap=False, smooth=False)
        for index in range(6):
            angle = math.pi / 2 + 2 * math.pi * index / 6
            radial = Vector((math.cos(angle), 0, math.sin(angle)))
            tangent = Vector((-math.sin(angle), 0, math.cos(angle)))
            points = []
            for along in (out * 0.015, out * 0.028):
                for radius, width in ((0.042, 0.014), (0.151, 0.014)):
                    points.extend((center + radial * radius + tangent * width + Vector((0, along, 0)), center + radial * radius - tangent * width + Vector((0, along, 0))))
            faces = ((4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (1, 5, 7, 3))
            if out < 0:
                faces = tuple(tuple(reversed(face)) for face in faces)
            part.add_cage(points, faces, ['metal'] * 6, levels=0, smooth=False)
        hub_profile = [(0.043, out * 0.012, 'metal'), (0.043, out * 0.040, 'metal')]
        cap_profile = [(0.025, out * 0.039, 'top'), (0.025, out * 0.048, 'top')]
        if out < 0:
            hub_profile.reverse()
            cap_profile.reverse()
        part.revolve((center.x, wheel_y, center.z), 'y', hub_profile, segments=12, smooth=False)
        part.revolve((center.x, wheel_y, center.z), 'y', cap_profile, segments=12, smooth=False)
        part.tube([(center.x, out * 0.285, center.z), (center.x, wheel_y, center.z)], 0.021, 'metal', sides=6)
        arch_fender(part, center, wheel_y)
    part.loft(
        [
            [(0.53 + radius * math.cos(-2 * math.pi * side / 12), along, 0.07 + radius * math.sin(-2 * math.pi * side / 12)) for side in range(12)]
            for radius, along in ((0.045, -0.018), (0.07, 0), (0.045, 0.018))
        ],
        lambda r, c: 'soft', levels=0, cap=False, smooth=False,
    )
    part.revolve((0.53, 0, 0.07), 'y', [(0.06, -0.01, 'metal'), (0.06, 0.01, 'metal')], segments=12, smooth=False)
    for side in (-1, 1):
        part.tube([(0.53, side * 0.032, 0.2), (0.53, side * 0.032, 0.07)], 0.006, 'metal', sides=4)
    part.tube([(0.53, -0.032, 0.07), (0.53, 0.032, 0.07)], 0.007, 'metal', sides=4)
    part.tube([(0.53, 0, 0.24), (0.53, 0, 0.27)], 0.012, 'metal', sides=4)
    box_solid(part, (0.53, 0, 0.248), (0.1, 0.1, 0.012), 'metal')
    part.revolve((0.53, 0, 0.185), 'z', [(0.03, 0, 'metal'), (0.03, 0.06, 'metal')], segments=12, smooth=False)


def display_case(part):
    for x in (-0.49, 0.49):
        for y in (-0.215, 0.215):
            part.tube([(x, y, 0.985), (x, y, 1.525)], 0.012, 'metal', sides=4)
    for z in (0.985, 1.525):
        part.tube([(-0.49, -0.215, z), (0.49, -0.215, z), (0.49, 0.215, z), (-0.49, 0.215, z)], 0.011, 'metal', sides=4, closed=True)
    pane_reflections(part, 'y', -0.215, -0.48, 0.48, 0.996, 1.514, -1)
    for side in (-1, 1):
        pane_reflections(part, 'x', side * 0.49, -0.204, 0.204, 0.996, 1.514, side)
    glass_panel(part, 'y', (-0.455, -0.212, 1.255), (0.02, 0.53, 0.006))
    glass_panel(part, 'y', (0.455, -0.212, 1.255), (0.02, 0.53, 0.006))
    glass_panel(part, 'y', (0, -0.209, 1.507), (0.90, 0.02, 0.006))
    box_solid(part, (0, 0, 1.533), (0.98, 0.44, 0.014), 'metal')
    box_solid(part, (0, -0.218, 1.542), (0.99, 0.025, 0.025), 'metal')
    for x0, x1, y in ((-0.475, 0.035, 0.221), (-0.425, 0.085, 0.207)):
        flat_frame(part, x0, x1, y + 0.003, 0.996, 1.514, 0.012)
        pane_reflections(part, 'y', y + 0.003, x0 + 0.012, x1 - 0.012, 1.008, 1.502, 1)
    for z in (0.991, 1.519):
        part.tube([(-0.47, 0.226, z), (0.47, 0.226, z)], 0.004, 'metal', sides=4)
    part.tube([(0.032, 0.207, 1.23), (0.032, 0.23, 1.23), (0.032, 0.23, 1.30)], 0.005, 'metal', sides=4)
    box_solid(part, (0, 0.005, 1.26), (0.96, 0.40, 0.012), 'top')
    box_solid(part, (0, -0.198, 1.262), (0.90, 0.018, 0.026), 'metal')
    for x, row in ((-0.36, 'body'), (-0.08, 'top')):
        box_solid(part, (x, 0.01, 1.331), (0.105, 0.115, 0.13), row, omit_top=True)
        gable = [(side, y, z) for side in (x - 0.0525, x + 0.0525) for y, z in ((-0.0475, 1.396), (0.0675, 1.396), (0.01, 1.434))]
        part.add_cage(gable, ((2, 1, 0), (3, 4, 5), (1, 2, 5, 4), (2, 0, 3, 5)), ['soft'] * 4, levels=0, smooth=False)
        box_solid(part, (x, -0.049, 1.328), (0.084, 0.004, 0.045), 'trim')
    for x, row in ((0.18, 'trim'), (0.36, 'soft')):
        box_solid(part, (x, 0.01, 1.325), (0.094, 0.094, 0.115), row)
        box_solid(part, (x, 0.01, 1.389), (0.098, 0.098, 0.014), 'metal')
        box_solid(part, (x, -0.039, 1.325), (0.078, 0.004, 0.043), 'top')
    for x, row in ((-0.23, 'trim'),):
        part.revolve((x, -0.015, 1.266), 'z', [(0.040, 0, row), (0.032, 0.13, row), (0.039, 0.136, 'top'), (0.037, 0.149, 'top')], segments=8, smooth=False)
        part.tube([(x, -0.015, 1.407), (x + 0.012, -0.015, 1.48)], 0.004, 'metal', sides=4)
    for x in (-0.30, -0.20, -0.10):
        for level in range(2 if x == -0.20 else 1):
            base = 0.984 + level * 0.096
            part.revolve((x, -0.08, base), 'z', [(0.033, 0, 'body'), (0.041, 0.086, 'body'), (0.044, 0.09, 'top'), (0.041, 0.096, 'top')], segments=8, smooth=False)
    for x, row in ((0.18, 'trim'), (0.32, 'soft')):
        part.revolve((x, 0.02, 0.984), 'z', [(0.034, 0, row), (0.034, 0.105, row), (0.026, 0.128, row), (0.018, 0.132, row), (0.018, 0.16, 'metal'), (0.023, 0.168, 'top')], segments=8, smooth=False)
        part.revolve((x, 0.02, 1.042), 'z', [(0.038, 0, 'top'), (0.038, 0.031, 'top')], segments=8, smooth=False)
    part.revolve((0.43, -0.08, 0.984), 'z', [(0.028, 0, 'soft'), (0.027, 0.10, 'soft'), (0.018, 0.11, 'metal')], segments=8, smooth=False)
    part.tube([(0.43, -0.08, 1.09), (0.43, -0.08, 1.127), (0.46, -0.08, 1.127)], 0.005, 'metal', sides=4)


def menu_lightbox(part, x):
    part.rounded_box((x, -0.335, 1.35), (0.32, 0.05, 0.5), 'metal', radius=0.008, segments=1)
    part.oriented_poly([(x - 0.13, -0.363, 1.13), (x + 0.13, -0.363, 1.13), (x + 0.13, -0.363, 1.57), (x - 0.13, -0.363, 1.57)], (0, -1, 0), 'screen')
    part.tube([(x - 0.14, -0.366, 1.12), (x + 0.14, -0.366, 1.12), (x + 0.14, -0.366, 1.58), (x - 0.14, -0.366, 1.58)], 0.006, 'strip', sides=4, closed=True)
    part.tube([(x, -0.335, 0.97), (x, -0.335, 1.104)], 0.012, 'metal', sides=4)


def kiosk_body(cart):
    kiosk_wheels(cart)
    before = set(cart.bm.faces)
    cart.rounded_box((0, 0, 0.59), (1.3, 0.62, 0.68), 'metal', radius=0.014, segments=1)
    remove_hidden_face(cart, set(cart.bm.faces) - before, 1, -0.31, -1)
    cart.rounded_box((0, 0, 0.958), (1.38, 0.68, 0.06), 'top', radius=0.014, segments=2)
    box_solid(cart, (0, -0.316, 0.914), (1.30, 0.034, 0.018), 'metal')
    box_solid(cart, (0, -0.318, 0.31), (1.28, 0.022, 0.075), 'metal')
    cart.tube([(-0.64, -0.347, 0.929), (0.64, -0.347, 0.929)], 0.005, 'strip', sides=4)
    cart.oriented_poly([(-0.61, -0.337, 0.35), (0.61, -0.337, 0.35), (0.61, -0.337, 0.87), (-0.61, -0.337, 0.87)], (0, -1, 0), 'screen')
    flat_frame(cart, -0.625, 0.625, -0.342, 0.335, 0.885, 0.008)
    cart.tube([(-0.606, -0.345, 0.354), (0.606, -0.345, 0.354), (0.606, -0.345, 0.866), (-0.606, -0.345, 0.866)], 0.005, 'strip', sides=4, closed=True)
    cart.oriented_poly([(-0.105, -0.349, 0.565), (0.605, -0.349, 0.565), (0.605, -0.349, 0.775), (-0.105, -0.349, 0.775)], (0, -1, 0), 'body')
    cart.image_rect([(-0.07, -0.353, 0.59), (0.57, -0.353, 0.59), (0.57, -0.353, 0.75), (-0.07, -0.353, 0.75)], 'decal', (0, 0, 1, 1))
    flat_frame(cart, -0.109, 0.609, -0.357, 0.561, 0.779, 0.006)
    for side in (-1, 1):
        for y in (-0.15, 0.15):
            cart.tube([(side * 0.652, y, 0.3), (side * 0.652, y, 0.88)], 0.004, 'metal', sides=4)
    for x in (-0.22, 0.22):
        cart.tube([(x, 0.312, 0.3), (x, 0.312, 0.88)], 0.004, 'metal', sides=4)
    cart.rounded_box((-0.745, -0.02, 0.974), (0.21, 0.42, 0.022), 'top', radius=0.005, segments=1)
    for y in (-0.15, 0.15):
        cart.tube([(-0.64, y, 0.8), (-0.8, y, 0.969)], 0.008, 'metal', sides=4)
    for x in (-0.62, 0.62):
        for y, top in ((-0.27, 2.064), (0.27, 2.042)):
            cart.tube([(x, y, 0.97), (x, y, top)], 0.014, 'metal', sides=4)
    ribbed_roof(cart)
    cart.rounded_box((0, -0.36, 1.936), (1.10, 0.03, 0.26), 'soft', radius=0.010, segments=1)
    cart.image_rect([(-0.48, -0.379, 1.816), (0.48, -0.379, 1.816), (0.48, -0.379, 2.056), (-0.48, -0.379, 2.056)], 'decal', (0, 0, 1, 1))
    cart.tube([(-0.50, -0.383, 1.814), (0.50, -0.383, 1.814), (0.50, -0.383, 2.058), (-0.50, -0.383, 2.058)], 0.006, 'strip', sides=4, closed=True)
    scalloped_hem(cart)


def build_cart_b():
    cart = HeroPart('cart_b')
    kiosk_body(cart)
    display_case(cart)
    for x in (-0.66, 0.66):
        menu_lightbox(cart, x)
    bmesh.ops.remove_doubles(cart.bm, verts=cart.bm.verts[:], dist=1e-6)
    return cart


def build_stool_a():
    stool = HeroPart('stool_a')
    arch = [(-0.095, 0), (-0.095, 0.115)]
    arch.extend((0.095 * math.cos(math.pi - math.pi * step / 8), 0.115 + 0.095 * math.sin(math.pi * step / 8)) for step in range(1, 9))
    arch.append((0.095, 0))
    vertices = []
    faces = []
    rows = []
    for axis in ('x', 'y'):
        for sign in (-1, 1):
            outlines = [[(-foot, 0), (-foot + 0.013, 0.27), (foot - 0.013, 0.27), (foot, 0)] + list(reversed(arch)) for foot in (0.15, 0.137)]
            start = len(vertices)
            for offset, outline in zip((0.15, 0.137), outlines):
                vertices.extend((u, sign * (offset - 0.013 * z / 0.27), z) if axis == 'x' else (sign * (offset - 0.013 * z / 0.27), u, z) for u, z in outline)
            count = len(outlines[0])
            faces.extend(([start + i for i in range(count)], [start + count + i for i in reversed(range(count))]))
            rows.extend(('body', 'soft'))
            for index in range(1, count):
                if index == 1 or index >= 3:
                    next_index = (index + 1) % count
                    faces.append([start + index, start + next_index, start + count + next_index, start + count + index])
                    rows.append('soft' if index >= 4 and next_index != 0 else 'body')
    stool.add_cage(vertices, faces, rows, levels=0, smooth=False)
    bmesh.ops.remove_doubles(stool.bm, verts=stool.bm.verts[:], dist=1e-6)
    bmesh.ops.recalc_face_normals(stool.bm, faces=stool.bm.faces[:])
    stool.tube([(-0.133, -0.133, 0.024), (0.133, -0.133, 0.024), (0.133, 0.133, 0.024), (-0.133, 0.133, 0.024)], 0.009, 'soft', sides=4, closed=True)
    bmesh.ops.remove_doubles(stool.bm, verts=stool.bm.verts[:], dist=1e-6)
    rings = []
    for half, z, radius in ((0.138, 0.258, 0.001), (0.138, 0.285, 0.007), (0.133, 0.305, 0.025), (0.118, 0.306, 0.025), (0.108, 0.302, 0.025), (0.092, 0.305, 0.025), (0.083, 0.302, 0.025), (0.007, 0.302, 0.005), (0.007, 0.276, 0.005)):
        rings.append([(x, y, z) for x, y in rounded_rect(0, 0, half, half, radius, 1)])
    stool.loft(rings, lambda ring, side: 'soft' if ring >= 7 else 'top' if ring in (2, 3, 5, 6) else 'body', levels=0, cap=False, smooth=False)
    for face in stool.bm.faces:
        face[stool.key_layer] = 0.16 if face.calc_center_median().z > 0.29 and face.normal.z > 0 else 0.72
    orient_shells(stool)
    return stool


def build_stool_b():
    stool = HeroPart('stool_b')
    seat_layers = (
        (0.394, 0.192, 0.172, 0.044),
        (0.382, 0.220, 0.198, 0.048),
        (0.415, 0.224, 0.202, 0.052),
        (0.431, 0.214, 0.192, 0.058),
        (0.419, 0.142, 0.128, 0.042),
    )
    seat_rings = []
    for z, hw, hd, radius in seat_layers:
        base_pts = rounded_rect(0, -0.014, hw, hd, radius, 2)
        ring = []
        for x, y in base_pts:
            taper = 1.0 - 0.085 * (y / max(hd, 1e-4))
            dish = -0.003 * max(0.0, 1.0 - (x / max(hw, 1e-4)) ** 2) if z > 0.425 and y < 0 else 0.0
            ring.append((x * taper, y, z + dish))
        seat_rings.append(ring)
    seat_verts = [pt for ring in seat_rings for pt in ring]
    ring_len = len(seat_rings[0])
    bot_center = len(seat_verts)
    seat_verts.extend((
        (0.062, 0.040, 0.395),
        (-0.062, 0.040, 0.395),
        (-0.066, -0.068, 0.395),
        (0.066, -0.068, 0.395),
    ))
    top_center = len(seat_verts)
    seat_verts.extend((
        (0.052, 0.034, 0.417),
        (-0.052, 0.034, 0.417),
        (-0.056, -0.062, 0.417),
        (0.056, -0.062, 0.417),
    ))
    seat_faces = []
    seat_rows = []
    for r in range(len(seat_rings) - 1):
        row_name = 'top' if r >= 2 else 'body'
        for c in range(ring_len):
            n = (c + 1) % ring_len
            seat_faces.append((r * ring_len + c, r * ring_len + n, (r + 1) * ring_len + n, (r + 1) * ring_len + c))
            seat_rows.append(row_name)
    seat_faces.append((bot_center, bot_center + 3, bot_center + 2, bot_center + 1))
    seat_rows.append('soft')
    top_ring = (len(seat_rings) - 1) * ring_len
    seat_faces.append((top_center, top_center + 1, top_center + 2, top_center + 3))
    seat_rows.append('top')
    for side_idx in range(4):
        i0 = side_idx * 3
        i1 = i0 + 1
        i2 = i0 + 2
        i3 = (i0 + 3) % ring_len
        c0 = side_idx
        c1 = (side_idx + 1) % 4
        seat_faces.extend((
            (i1, i0, bot_center + c0),
            (i2, i1, bot_center + c0),
            (i3, i2, bot_center + c0, bot_center + c1),
        ))
        seat_rows.extend(('soft', 'soft', 'soft'))
        seat_faces.extend((
            (top_ring + i0, top_ring + i1, top_center + c0),
            (top_ring + i1, top_ring + i2, top_center + c0),
            (top_ring + i2, top_ring + i3, top_center + c1, top_center + c0),
        ))
        seat_rows.extend(('top', 'top', 'top'))
    stool.add_cage(seat_verts, seat_faces, seat_rows, levels=0, smooth=True)

    back_levels = (
        (0.382, 0.194, 0.000, 0.026),
        (0.446, 0.198, 0.005, 0.027),
        (0.504, 0.202, 0.014, 0.028),
        (0.564, 0.204, 0.022, 0.030),
        (0.624, 0.204, 0.030, 0.030),
        (0.682, 0.196, 0.048, 0.029),
        (0.736, 0.172, 0.066, 0.027),
        (0.766, 0.136, 0.074, 0.024),
    )

    def eval_backrest(u, t):
        idx = min(int(t), len(back_levels) - 2)
        frac = t - idx
        z0, hw0, arch0, thick0 = back_levels[idx]
        z1, hw1, arch1, thick1 = back_levels[idx + 1]
        z_edge = z0 + (z1 - z0) * frac
        hw = hw0 + (hw1 - hw0) * frac
        arch_lift = arch0 + (arch1 - arch0) * frac
        thick = thick0 + (thick1 - thick0) * frac
        arch_factor = math.sqrt(max(0.0, 1.0 - 0.88 * u * u))
        z = z_edge + arch_lift * arch_factor
        if abs(u) > 0.999:
            if abs(t - 3.0) < 1e-6:
                z = 0.602
            elif abs(t - 4.0) < 1e-6:
                z = 0.626
        x = u * hw
        y_spine = 0.156 + 0.218 * (z - 0.400)
        y_curve = -0.038 * (x / 0.204) ** 2
        y_mid = y_spine + y_curve
        return (
            (x, y_mid - 0.5 * thick, z),
            (x, y_mid + 0.5 * thick, z),
        )

    hole_cols = 4
    hole_rows = 4
    u_min, u_max = -0.75, 0.75
    bar_du = 0.075
    hole_du = (u_max - u_min - (hole_cols - 1) * bar_du) / hole_cols
    u_lattice = [u_min]
    for step in range(hole_cols):
        u_lattice.append(u_lattice[-1] + hole_du)
        if step < hole_cols - 1:
            u_lattice.append(u_lattice[-1] + bar_du)

    t_min, t_max = 2.0, 5.85
    bar_dt = 0.22
    hole_dt = (t_max - t_min - (hole_rows - 1) * bar_dt) / hole_rows
    t_lattice = [t_min]
    for step in range(hole_rows):
        t_lattice.append(t_lattice[-1] + hole_dt)
        if step < hole_rows - 1:
            t_lattice.append(t_lattice[-1] + bar_dt)

    back_verts = []

    def add_pair(u, t):
        f_pt, b_pt = eval_backrest(u, t)
        f_idx = len(back_verts)
        back_verts.append(f_pt)
        b_idx = len(back_verts)
        back_verts.append(b_pt)
        return f_idx, b_idx

    lat_n = len(u_lattice)
    lat_m = len(t_lattice)
    lat_f = [[0] * lat_n for _ in range(lat_m)]
    lat_b = [[0] * lat_n for _ in range(lat_m)]
    for r_idx, t in enumerate(t_lattice):
        for c_idx, u in enumerate(u_lattice):
            f_idx, b_idx = add_pair(u, t)
            lat_f[r_idx][c_idx] = f_idx
            lat_b[r_idx][c_idx] = b_idx

    u_bot_vals = (-1.0, -0.42, 0.0, 0.42, 1.0)
    t_side_vals = (0.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0)
    u_top_vals = (1.0, 0.8, 0.4, 0.0, -0.4, -0.8, -1.0)

    out_bot = [add_pair(u, 0.0) for u in u_bot_vals]
    out_right = [out_bot[-1]] + [add_pair(1.0, t) for t in t_side_vals[1:]]
    out_top = [out_right[-1]] + [add_pair(u, 7.0) for u in u_top_vals[1:]]
    out_left = [out_top[-1]] + [add_pair(-1.0, t) for t in reversed(t_side_vals[1:-1])] + [out_bot[0]]

    port_mids = {}
    for sign_key, f3_idx, b3_idx, f4_idx, b4_idx in (
        (-1, out_left[4][0], out_left[4][1], out_left[3][0], out_left[3][1]),
        (1, out_right[2][0], out_right[2][1], out_right[3][0], out_right[3][1]),
    ):
        f3 = Vector(back_verts[f3_idx])
        b3 = Vector(back_verts[b3_idx])
        f4 = Vector(back_verts[f4_idx])
        b4 = Vector(back_verts[b4_idx])
        mid_b = (f3 + b3) * 0.5 + Vector((sign_key * 0.004, 0.0, -0.002))
        mid_t = (f4 + b4) * 0.5 + Vector((sign_key * 0.004, 0.0, 0.003))
        idx_b = len(back_verts)
        back_verts.append((mid_b.x, mid_b.y, mid_b.z))
        idx_t = len(back_verts)
        back_verts.append((mid_t.x, mid_t.y, mid_t.z))
        port_mids[sign_key] = (
            idx_b,
            idx_t,
            (mid_b.x, mid_b.y, mid_b.z),
            (mid_t.x, mid_t.y, mid_t.z),
            back_verts[f3_idx],
            back_verts[f4_idx],
            back_verts[b3_idx],
            back_verts[b4_idx],
        )

    back_faces = []
    back_face_rows = []
    hole_wall_indices = set()

    for r in range(lat_m - 1):
        for c in range(lat_n - 1):
            f00 = lat_f[r][c]
            f10 = lat_f[r][c + 1]
            f11 = lat_f[r + 1][c + 1]
            f01 = lat_f[r + 1][c]
            b00 = lat_b[r][c]
            b10 = lat_b[r][c + 1]
            b11 = lat_b[r + 1][c + 1]
            b01 = lat_b[r + 1][c]
            if r % 2 == 0 and c % 2 == 0:
                base_idx = len(back_faces)
                back_faces.extend((
                    (f00, f10, b10, b00),
                    (f01, b01, b11, f11),
                    (f00, b00, b01, f01),
                    (f10, f11, b11, b10),
                ))
                back_face_rows.extend(('body', 'body', 'body', 'body'))
                hole_wall_indices.update(range(base_idx, base_idx + 4))
            else:
                back_faces.append((f00, f10, f11, f01))
                back_face_rows.append('body')
                back_faces.append((b00, b01, b11, b10))
                back_face_rows.append('body')

    def bridge_rim(out_chain, in_f, in_b):
        m_len = len(out_chain) - 1
        k_len = len(in_f) - 1
        i_idx, j_idx = 0, 0
        while i_idx < m_len or j_idx < k_len:
            if i_idx == m_len:
                take_inner = True
            elif j_idx == k_len:
                take_inner = False
            else:
                d_in = (Vector(back_verts[out_chain[i_idx][0]]) - Vector(back_verts[in_f[j_idx + 1]])).length_squared
                d_out = (Vector(back_verts[out_chain[i_idx + 1][0]]) - Vector(back_verts[in_f[j_idx]])).length_squared
                take_inner = d_in < d_out
            if take_inner:
                back_faces.append((out_chain[i_idx][0], in_f[j_idx + 1], in_f[j_idx]))
                back_face_rows.append('body')
                back_faces.append((out_chain[i_idx][1], in_b[j_idx], in_b[j_idx + 1]))
                back_face_rows.append('body')
                j_idx += 1
            else:
                back_faces.append((out_chain[i_idx][0], out_chain[i_idx + 1][0], in_f[j_idx]))
                back_face_rows.append('body')
                back_faces.append((out_chain[i_idx][1], in_b[j_idx], out_chain[i_idx + 1][1]))
                back_face_rows.append('body')
                i_idx += 1

    bridge_rim(out_bot, lat_f[0], lat_b[0])
    bridge_rim(out_right, [lat_f[r][-1] for r in range(lat_m)], [lat_b[r][-1] for r in range(lat_m)])
    bridge_rim(out_top, list(reversed(lat_f[-1])), list(reversed(lat_b[-1])))
    bridge_rim(out_left, [lat_f[r][0] for r in range(lat_m - 1, -1, -1)], [lat_b[r][0] for r in range(lat_m - 1, -1, -1)])

    for idx in range(len(out_bot) - 1):
        f0, b0 = out_bot[idx]
        f1, b1 = out_bot[idx + 1]
        back_faces.append((f0, b0, b1, f1))
        back_face_rows.append('soft')

    for idx in range(len(out_top) - 1):
        f0, b0 = out_top[idx]
        f1, b1 = out_top[idx + 1]
        back_faces.append((f0, b0, b1, f1))
        back_face_rows.append('body')

    for idx in range(len(out_right) - 1):
        if idx == 2:
            continue
        f0, b0 = out_right[idx]
        f1, b1 = out_right[idx + 1]
        if idx == 1:
            mb_r = port_mids[1][0]
            back_faces.extend(((f0, b0, mb_r, f1), (mb_r, b0, b1)))
            back_face_rows.extend(('body', 'body'))
        elif idx == 3:
            mt_r = port_mids[1][1]
            back_faces.extend(((f0, mt_r, b1, f1), (mt_r, b0, b1)))
            back_face_rows.extend(('body', 'body'))
        else:
            back_faces.append((f0, b0, b1, f1))
            back_face_rows.append('body')

    for idx in range(len(out_left) - 1):
        if idx == 3:
            continue
        f0, b0 = out_left[idx]
        f1, b1 = out_left[idx + 1]
        if idx == 4:
            mb_l = port_mids[-1][0]
            back_faces.extend(((f1, f0, mb_l, b1), (mb_l, b0, b1)))
            back_face_rows.extend(('body', 'body'))
        elif idx == 2:
            mt_l = port_mids[-1][1]
            back_faces.extend(((f1, f0, b0, mt_l), (mt_l, b0, b1)))
            back_face_rows.extend(('body', 'body'))
        else:
            back_faces.append((f0, b0, b1, f1))
            back_face_rows.append('body')

    before_back = set(stool.bm.faces)
    stool.add_cage(back_verts, back_faces, back_face_rows, levels=0, smooth=True)
    created_back = [f for f in stool.bm.faces if f not in before_back]
    for idx in hole_wall_indices:
        created_back[idx].smooth = False

    def profile_points(hw, b):
        return (
            (-hw, -0.0055),
            (-hw * 0.84, 0.008),
            (0.0, 0.0125),
            (hw * 0.84, 0.008),
            (hw, -0.0055),
            (0.0, 0.001 - 0.006 * b),
        )

    def leg_profile_points(hw):
        return (
            (-hw, -0.006),
            (-hw * 0.84, 0.008),
            (0.0, 0.0125),
            (hw * 0.84, 0.008),
            (hw, -0.006),
            (0.0, 0.001),
        )

    def add_hex_loft(rings_list, row_fn, flip, cap_end=True):
        verts = [pt for ring in rings_list for pt in ring]
        last = (len(rings_list) - 1) * 6
        faces = [
            (0, 5, 2, 1),
            (2, 5, 4, 3),
        ]
        rows = ['soft', 'soft']
        if cap_end:
            faces.extend((
                (last + 0, last + 1, last + 2, last + 5),
                (last + 2, last + 3, last + 4, last + 5),
            ))
            rows.extend((row_fn(len(rings_list) - 2, 0), row_fn(len(rings_list) - 2, 0)))
        for r_i in range(len(rings_list) - 1):
            for c_i in range(6):
                n_i = (c_i + 1) % 6
                faces.append((r_i * 6 + c_i, r_i * 6 + n_i, (r_i + 1) * 6 + n_i, (r_i + 1) * 6 + c_i))
                rows.append(row_fn(r_i, c_i))
        if flip:
            faces = [tuple(reversed(f)) for f in faces]
        stool.add_cage(verts, faces, rows, levels=0, smooth=True)

    bend_angles = [math.radians(7.0 + (85.0 - 7.0) * step / 7) for step in range(8)]
    yc, zc, radius_arc = -0.102, 0.486, 0.104
    for sign in (-1, 1):
        stations = [
            (0.258, -0.258, 0.000, 0.0235, 0.0, 20.0, math.radians(7.0)),
        ]
        for step, theta in enumerate(bend_angles):
            frac = step / 7.0
            y = yc - radius_arc * math.cos(theta)
            z = zc + radius_arc * math.sin(theta)
            x = 0.258 - 0.036 * z
            hw = 0.0258 + 0.0016 * frac
            b = 0.2 + 0.8 * frac
            yaw_deg = 16.0 * (1.0 - frac) + 3.0 * frac
            stations.append((x, y, z, hw, b, yaw_deg, theta))
        stations.extend((
            (0.236, 0.015, 0.601, 0.0274, 1.0, 6.0, math.radians(85.2)),
            (0.228, 0.105, 0.609, 0.0250, 1.0, 28.0, math.radians(85.6)),
            (0.211, 0.156, 0.613, 0.0175, 1.0, 64.0, math.radians(86.0)),
        ))
        rings = []
        for r_idx, (x, y, z, hw, b, yaw_deg, theta) in enumerate(stations):
            center = Vector((sign * x, y, z))
            yaw = math.radians(sign * yaw_deg)
            side_vec = Vector((sign * math.cos(yaw), math.sin(yaw), 0.0)).normalized()
            out_2d = Vector((0.0, -math.cos(theta), math.sin(theta)))
            norm_vec = (out_2d - side_vec * out_2d.dot(side_vec)).normalized()
            pts = []
            for u, v in profile_points(hw, b):
                pt = center + side_vec * u + norm_vec * v
                if r_idx == 0:
                    pt.z = 0.0
                pts.append((pt.x, pt.y, pt.z))
            rings.append(pts)
        _, _, mid_b_pt, mid_t_pt, f3_pt, f4_pt, b3_pt, b4_pt = port_mids[sign]
        rings.append([
            f3_pt,
            f4_pt,
            mid_t_pt,
            b4_pt,
            b3_pt,
            mid_b_pt,
        ])

        add_hex_loft(rings, lambda r_i, c_i: 'body', sign < 0, cap_end=False)

    for sign in (-1, 1):
        rear_stations = (
            (0.236, 0.224, 0.000, 0.0200, 16.0),
            (0.211, 0.194, 0.207, 0.0228, 15.0),
            (0.186, 0.164, 0.414, 0.0250, 14.0),
        )
        rear_rings = []
        tilt_rear = math.radians(8.5)
        for r_idx, (x, y, z, hw, yaw_deg) in enumerate(rear_stations):
            center = Vector((sign * x, y, z))
            yaw = math.radians(yaw_deg)
            side_vec = Vector((sign * math.cos(yaw), -math.sin(yaw), 0.0)).normalized()
            out_dir = Vector((sign * math.sin(yaw) * math.cos(tilt_rear), math.cos(yaw) * math.cos(tilt_rear), math.sin(tilt_rear))).normalized()
            pts = []
            for u, v in leg_profile_points(hw):
                pt = center + side_vec * u + out_dir * v
                if r_idx == 0:
                    pt.z = 0.0
                pts.append((pt.x, pt.y, pt.z))
            rear_rings.append(pts)
        add_hex_loft(rear_rings, lambda r_i, c_i: 'body', sign < 0)

    bmesh.ops.remove_doubles(stool.bm, verts=stool.bm.verts[:], dist=1e-5)

    for face in stool.bm.faces:
        face.normal_update()
        center_z = face.calc_center_median().z
        if face.normal.z < -0.85 and center_z < 0.02:
            face[stool.row_layer] = ALL_ROWS.index('soft')
        if face[stool.key_layer] < 0:
            if face.normal.z > 0.45 and center_z > 0.41:
                face[stool.key_layer] = 0.16
            elif face.normal.y < -0.3:
                face[stool.key_layer] = 0.25
            else:
                face[stool.key_layer] = 0.68
    orient_shells(stool)
    return stool


def apron_skirt(part, outer, inner, bottom, top, row):
    outer_bottom = [(-outer, -outer, bottom), (outer, -outer, bottom), (outer, outer, bottom), (-outer, outer, bottom)]
    inner_bottom = [(-inner, -inner, bottom), (inner, -inner, bottom), (inner, inner, bottom), (-inner, inner, bottom)]
    vertices = outer_bottom + inner_bottom + [(x, y, top) for x, y, _ in outer_bottom] + [(x, y, top) for x, y, _ in inner_bottom]
    faces = [
        [0, 1, 9, 8], [1, 2, 10, 9], [2, 3, 11, 10], [3, 0, 8, 11],
        [4, 12, 13, 5], [5, 13, 14, 6], [6, 14, 15, 7], [7, 15, 12, 4],
        [8, 9, 13, 12], [9, 10, 14, 13], [10, 11, 15, 14], [11, 8, 12, 15],
        [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0],
    ]
    part.add_cage(vertices, faces, [row] * len(faces), levels=0, smooth=False)


def build_lowtable():
    table = HeroPart('lowtable_a')
    top_half = 0.278
    foot_half = 0.302
    chamfer = 0.02
    wall = 0.013
    top_z = 0.462
    slope = (foot_half - top_half) / top_z

    def half_at(z):
        return foot_half - slope * z

    stations = (
        (-0.258, -0.2803, 0.0),
        (-0.252, -0.252, 0.0),
        (-0.2168, -0.2168, 0.383),
        (-0.207, -0.207, 0.390),
        (-0.155, -0.155, 0.396),
        (0.0, 0.0, 0.400),
        (0.155, 0.155, 0.396),
        (0.207, 0.207, 0.390),
        (0.2168, 0.2168, 0.383),
        (0.252, 0.252, 0.0),
        (0.258, 0.2803, 0.0),
    )

    def plan(side, along, depth):
        if side == 0:
            return (along, -depth)
        if side == 1:
            return (depth, along)
        if side == 2:
            return (-along, depth)
        return (-depth, -along)

    rings = []
    for side in range(4):
        for top_along, foot_along, bottom in stations:
            outer_bottom = plan(side, foot_along, half_at(bottom))
            inner_bottom = plan(side, foot_along, half_at(bottom) - wall)
            outer_top = plan(side, top_along, top_half)
            inner_top = plan(side, top_along, top_half - wall)
            rings.append((
                (outer_bottom[0], outer_bottom[1], bottom),
                (inner_bottom[0], inner_bottom[1], bottom),
                (outer_top[0], outer_top[1], top_z),
                (inner_top[0], inner_top[1], top_z),
            ))
    vertices = [point for ring in rings for point in ring]
    faces = []
    rows = []
    for index in range(len(rings)):
        current = 4 * index
        following = 4 * ((index + 1) % len(rings))
        faces.append((current, following, following + 2, current + 2))
        rows.append('body')
        faces.append((following + 1, current + 1, current + 3, following + 3))
        rows.append('soft')
        faces.append((current + 1, following + 1, following, current))
        rows.append('soft')
    table.add_cage(vertices, faces, rows, levels=0, smooth=True)
    table.slab(0, 0, 0.3, 0.3, 0.026, [(0.456, 0.009, 'body'), (0.477, 0, 'body'), (0.49, 0, 'top'), (0.497, 0.004, 'top'), (0.5, 0.012, 'top'), (0.49, 0.03, 'top'), (0.487, 0.047, 'soft')], corner=1)
    for face in table.bm.faces:
        face[table.key_layer] = 0.16 if face.normal.z > 0.35 else 0.72
        if face.normal.z < -0.35:
            face[table.row_layer] = ALL_ROWS.index('soft')
    orient_shells(table)
    return table


def build_parasol():
    parasol = HeroPart('parasol_a')
    outline = [(-0.23, -0.065), (-0.065, -0.065), (-0.065, -0.23), (0.065, -0.23), (0.065, -0.065), (0.23, -0.065), (0.23, 0.065), (0.065, 0.065), (0.065, 0.23), (-0.065, 0.23), (-0.065, 0.065), (-0.23, 0.065)]
    vertices = [(x, y, z) for z in (0, 0.075) for x, y in outline]
    count = len(outline)
    faces = [list(reversed(range(count))), [count + index for index in range(count)]]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append([index, next_index, count + next_index, count + index])
    parasol.add_cage(vertices, faces, ['body'] * len(faces), levels=0, smooth=False)
    parasol.revolve((0, 0, 0), 'z', [(0.1, 0.07, 'metal'), (0.105, 0.085, 'metal'), (0.045, 0.1, 'metal')], segments=10, smooth=False)
    parasol.revolve((0, 0, 0), 'z', [(0.028, 0.08, 'metal'), (0.028, 2.39, 'metal'), (0.014, 2.395, 'metal')], segments=10, smooth=False)
    rings = []
    for radius, z in ((0.035, 2.395), (0.35, 2.34), (0.75, 2.19), (1.095, 2.02)):
        rings.append([(radius * math.cos(2 * math.pi * side / 32), radius * math.sin(2 * math.pi * side / 32), z) for side in range(32)])
    parasol.loft(rings, lambda r, c: 'top' if c % 8 < 4 else 'soft', levels=0, cap=False, smooth=False)
    hem = [[(1.095 * math.cos(2 * math.pi * side / 32), 1.095 * math.sin(2 * math.pi * side / 32), z) for side in range(32)] for z in (2.02, 1.94)]
    for side, point in enumerate(hem[1]):
        hem[1][side] = (point[0], point[1], 1.96 if side % 4 in (0, 3) else 1.925)
    parasol.loft(hem, lambda r, c: 'soft' if c % 8 < 4 else 'top', levels=0, cap=False, smooth=False)
    for side in range(8):
        angle = 2 * math.pi * side / 8
        parasol.tube([(0.025 * math.cos(angle), 0.025 * math.sin(angle), 2.355), (0.34 * math.cos(angle), 0.34 * math.sin(angle), 2.34), (1.06 * math.cos(angle), 1.06 * math.sin(angle), 2.02)], 0.007, 'metal', sides=3)
    parasol.revolve((0, 0, 0), 'z', [(0.038, 1.67, 'metal'), (0.052, 1.69, 'body'), (0.052, 1.73, 'body'), (0.038, 1.75, 'metal')], segments=10, smooth=False)
    parasol.tube([(0.025, 0, 1.32), (0.1, 0, 1.32), (0.1, -0.055, 1.32)], 0.008, 'metal', sides=4)
    bmesh.ops.remove_doubles(parasol.bm, verts=parasol.bm.verts[:], dist=1e-6)
    return parasol


def build_cooler():
    cooler = HeroPart('cooler_a')
    cooler.slab(0, 0, 0.29, 0.19, 0.03, [(0, 0, 'floor'), (0.04, 0, 'soft'), (0.055, 0, 'body'), (0.38, 0, 'body'), (0.412, 0.012, 'body')], corner=2)
    cooler.rounded_box((0, 0, 0.417), (0.596, 0.396, 0.055), 'top', radius=0.012, segments=1)
    for y in (-0.075, 0.075):
        cooler.tube([(-0.18, y, 0.443), (0.18, y, 0.443)], 0.004, 'soft', sides=3)
    for side in (-1, 1):
        cooler.tube([(side * 0.282, -0.075, 0.255), (side * 0.29, -0.075, 0.32), (side * 0.29, 0.075, 0.32), (side * 0.282, 0.075, 0.255)], 0.006, 'metal', sides=4)
    cooler.tube([(0, -0.188, 0.085), (0, -0.196, 0.085)], 0.015, 'metal', sides=8)
    return cooler
