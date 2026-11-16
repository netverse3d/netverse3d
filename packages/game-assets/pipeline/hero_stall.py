import math

import bmesh
from mathutils import Vector

from hero_kit import HeroPart


def remove_hidden_face(part, new_faces, axis, position, normal):
    hidden = []
    for face in new_faces:
        face.normal_update()
        if abs(face.calc_center_median()[axis] - position) < 1e-5 and face.normal[axis] * normal > 0.99:
            hidden.append(face)
    if hidden:
        bmesh.ops.delete(part.bm, geom=hidden, context='FACES')


def cart_wheels(part):
    for sign in (-1, 1):
        x = sign * 0.66
        center = Vector((x, 0.13, 0.27))
        for profile, row in (
            ([(0.19, -0.018), (0.235, -0.023), (0.27, 0), (0.235, 0.023), (0.19, 0.018), (0.19, -0.018)], 'soft'),
            ([(0.172, -0.014), (0.205, -0.014), (0.205, 0.014), (0.172, 0.014), (0.172, -0.014)], 'metal'),
        ):
            rings = [[center + Vector((along, radius * math.cos(2 * math.pi * side / 12), radius * math.sin(2 * math.pi * side / 12))) for side in range(12)] for radius, along in profile]
            part.loft(rings, lambda r, c: row, levels=0, cap=False, smooth=False)
        for side in range(10):
            angle = 2 * math.pi * side / 10
            radial = Vector((0, math.cos(angle), math.sin(angle)))
            tangent = Vector((0, -math.sin(angle), math.cos(angle)))
            inner = center + radial * 0.038
            outer = center + radial * 0.188
            width = 0.006
            face = [inner - tangent * width, outer - tangent * width, outer + tangent * width, inner + tangent * width]
            part.oriented_poly(face, (sign, 0, 0), 'metal')
        part.revolve((x + sign * 0.006, 0.13, 0.27), 'x', [(0.055, -0.012, 'metal'), (0.055, 0.012, 'metal')], segments=10, smooth=False)
    part.tube([(0, 0.28, 0.5), (0, 0.34, 0.02)], 0.022, 'metal', sides=4)
    part.rounded_box((0, 0.34, 0.0175), (0.16, 0.1, 0.035), 'soft', radius=0.008, segments=1)


def cart_chassis(part):
    cart_wheels(part)
    part.rounded_box((0, 0.05, 0.53), (1.25, 0.67, 0.14), 'metal', radius=0.025, segments=1)
    part.rounded_box((0, -0.235, 0.76), (1.17, 0.045, 0.3), 'body', radius=0.012, segments=1)
    part.rounded_box((0, -0.262, 0.79), (0.8, 0.012, 0.045), 'trim', radius=0.003, segments=1)
    for x in (-0.31, 0.31):
        part.oriented_poly([(x - 0.2, -0.259, 0.66), (x + 0.2, -0.259, 0.66), (x + 0.2, -0.259, 0.86), (x - 0.2, -0.259, 0.86)], (0, -1, 0), 'trim')
        part.tube([(x - 0.21, -0.263, 0.65), (x - 0.21, -0.263, 0.87), (x + 0.21, -0.263, 0.87), (x + 0.21, -0.263, 0.65)], 0.007, 'metal', sides=3)
    part.tube([(-0.52, -0.26, 0.61), (0.52, -0.26, 0.61)], 0.01, 'metal', sides=4)
    for x in (-0.56, 0.56):
        for z in (0.69, 0.84):
            part.tube([(x, -0.263, z - 0.017), (x, -0.263, z + 0.017)], 0.006, 'metal', sides=3)
    part.tube([(-0.12, -0.274, 0.77), (0.12, -0.274, 0.77)], 0.012, 'metal', sides=4)
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


def curved_canopy(part, center_y, edge_z, half_width, half_depth, row):
    rings = []
    for step in range(49):
        x = half_width * (step / 24 - 1)
        arch = 0.026 * (1 - (x / half_width) ** 2)
        wave = 0.017 * (math.cos(2 * math.pi * x / 0.078) - 1) / 2
        rings.append([(x, center_y - half_depth, edge_z + arch + wave), (x, center_y + half_depth, edge_z + arch + wave - 0.022)])
    part.loft(rings, lambda r, c: row, levels=0, closed=False, cap=False, smooth=False)
    front_y = center_y - half_depth - 0.012
    part.rounded_box((0, front_y, edge_z - 0.004), (2 * half_width, 0.034, 0.07), 'metal', radius=0.012, segments=2)
    for x in (-half_width, half_width):
        part.tube([(x, center_y - half_depth, edge_z - 0.025), (x, center_y + half_depth, edge_z - 0.047)], 0.014, 'metal', sides=4)
    part.tube([(-half_width + 0.08, front_y - 0.015, edge_z - 0.037), (half_width - 0.08, front_y - 0.015, edge_z - 0.037)], 0.008, 'strip', sides=4)


def baguette(part, x, y, z, length):
    rings = []
    for step, width in enumerate((0.008, 0.052, 0.064, 0.052, 0.008)):
        along = length * (step / 4 - 0.5)
        center_z = z + 0.015 * math.sin(math.pi * step / 4)
        rings.append([(x + along, y + width * math.cos(2 * math.pi * side / 8), center_z + width * 0.8 * math.sin(2 * math.pi * side / 8)) for side in range(8)])
    part.loft(rings, lambda r, c: 'soft' if r < 3 else 'top', levels=0, smooth=False)
    for offset in (-0.105, 0.03):
        part.tube([(x + offset - 0.025, y - 0.038, z + 0.042), (x + offset + 0.02, y + 0.038, z + 0.052)], 0.0025, 'top', sides=3)


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
    cart_chassis(cart)
    cart.rounded_box((0.7, 0.1, 0.68), (0.18, 0.28, 0.025), 'metal', radius=0.007, segments=1)
    cart.tube([(0.63, 0.22, 0.6), (0.7, 0.22, 0.67)], 0.009, 'metal', sides=4)
    cart.revolve((0.7, 0.1, 0.684), 'z', [(0.052, 0, 'body'), (0.066, 0.018, 'body'), (0.066, 0.17, 'body'), (0.035, 0.2, 'metal')], segments=8, smooth=False)
    cart.rounded_box((0, 0.04, 0.96), (1.3, 0.72, 0.07), 'metal', radius=0.016, segments=2)
    for x in (-0.53, 0, 0.53):
        cart.rounded_box((x, 0.0, 1.005), (0.43, 0.5, 0.035), 'metal', radius=0.01, segments=1)
        cart.rounded_box((x, -0.263, 1.032), (0.37, 0.025, 0.025), 'trim', radius=0.005, segments=1)
    for x, y, z in ((-0.31, -0.11, 1.105), (0.17, -0.11, 1.105), (0.04, 0.09, 1.17)):
        baguette(cart, x, y, z, 0.39)
    cart.rounded_box((-0.43, 0.15, 1.07), (0.18, 0.15, 0.1), 'body', radius=0.008, segments=1)
    before = set(cart.bm.faces)
    cart.rounded_box((0.44, 0.15, 1.035), (0.26, 0.16, 0.025), 'top', radius=0.006, segments=1)
    remove_hidden_face(cart, set(cart.bm.faces) - before, 2, 1.0225, -1)
    for x in (-0.6, 0.6):
        for y in (-0.29, 0.33):
            cart.tube([(x, y, 1.0), (x, y, 1.59)], 0.016, 'metal', sides=4)
    for z in (1.04, 1.59):
        for y in (-0.29, 0.33):
            cart.tube([(-0.6, y, z), (0.6, y, z)], 0.014, 'metal', sides=4)
    for x in (-0.31, 0.31):
        cart.tube([(x, -0.3, 1.06), (x, -0.3, 1.57)], 0.007, 'metal', sides=4)
    for z in (1.075, 1.135):
        cart.tube([(-0.56, -0.308, z), (0.56, -0.308, z)], 0.008, 'metal', sides=4)
    glass_panel(cart, 'y', (0, -0.297, 1.548), (1.12, 0.072, 0.008))
    for x in (-0.585, 0.585):
        glass_panel(cart, 'x', (x, 0.02, 1.31), (0.62, 0.47, 0.008))
    glass_panel(cart, 'z', (0, 0.02, 1.585), (1.18, 0.62, 0.008))
    for x in (-0.55, 0.55):
        cart.tube([(x, 0.23, 1.589), (x, 0.23, 2.0)], 0.022, 'metal', sides=4)
    curved_canopy(cart, 0.04, 2.07, 0.765, 0.41, 'top')
    roof_sign(cart)
    for x in (-0.55, 0.55):
        cart.tube([(x, 0.23, 1.83), (x, -0.33, 2.025)], 0.012, 'metal', sides=4)
    bmesh.ops.remove_doubles(cart.bm, verts=cart.bm.verts[:], dist=1e-6)
    return cart


def build_cart_b():
    cart = HeroPart('cart_b')
    cart_chassis(cart)
    cart.rounded_box((0, 0.04, 0.96), (1.34, 0.76, 0.09), 'top', radius=0.025, segments=2)
    cart.rounded_box((-0.37, 0.05, 1.07), (0.49, 0.57, 0.2), 'metal', radius=0.025, segments=1)
    cart.rounded_box((-0.37, 0.05, 1.177), (0.53, 0.61, 0.035), 'body', radius=0.012, segments=2)
    before = set(cart.bm.faces)
    cart.rounded_box((-0.37, -0.244, 1.095), (0.22, 0.018, 0.025), 'trim', radius=0.005, segments=1)
    remove_hidden_face(cart, set(cart.bm.faces) - before, 1, -0.235, 1)
    for x in (-0.57, -0.17):
        cart.rounded_box((x, 0.34, 1.179), (0.045, 0.023, 0.025), 'metal', radius=0.004, segments=1)
    cart.rounded_box((-0.53, -0.244, 1.052), (0.028, 0.022, 0.028), 'body', radius=0.004, segments=1)
    for x in (0.06, 0.57):
        cart.tube([(x, 0.34, 0.98), (x, 0.34, 1.52)], 0.018, 'metal', sides=4)
    for z in (1.24, 1.48):
        cart.tube([(0.06, 0.34, z), (0.57, 0.34, z)], 0.016, 'metal', sides=4)
    for z in (1.25, 1.49):
        cart.oriented_poly([(0.07, 0.23, z), (0.55, 0.23, z), (0.55, 0.37, z), (0.07, 0.37, z)], (0, 0, 1), 'metal')
        cart.tube([(0.07, 0.221, z), (0.55, 0.221, z)], 0.008, 'metal', sides=4)
    cart.revolve((0.05, -0.14, 1.0), 'z', [(0.1, 0, 'metal'), (0.095, 0.2, 'metal'), (0.08, 0.21, 'top')], segments=10, smooth=False)
    for z in (1.208, 1.216, 1.224):
        rings = [[(0.05 + 0.083 * math.cos(2 * math.pi * side / 10), -0.14 + 0.083 * math.sin(2 * math.pi * side / 10), height) for side in range(10)] for height in (z, z + 0.008)]
        cart.loft(rings, lambda r, c: 'soft', levels=0, cap=False, smooth=False)
    for x in (0.13, 0.51):
        before = set(cart.bm.faces)
        cart.revolve((x, 0.29, 1.49), 'z', [(0.04, 0, 'body'), (0.038, 0.13, 'trim'), (0.036, 0.14, 'metal')], segments=8, smooth=False)
        remove_hidden_face(cart, set(cart.bm.faces) - before, 2, 1.49, -1)
    cart.revolve((0.51, -0.11, 1.0), 'z', [(0.04, 0, 'metal'), (0.038, 0.18, 'metal'), (0.042, 0.185, 'top')], segments=8, smooth=False)
    for x in (0.49, 0.51, 0.53):
        cart.tube([(x, -0.11, 1.18), (x + 0.005, -0.11, 1.32)], 0.003, 'soft', sides=3)
    cart.revolve((0.33, 0.03, 1.0), 'z', [(0.14, 0, 'metal'), (0.16, 0.03, 'metal'), (0.17, 0.35, 'body'), (0.16, 0.39, 'metal'), (0.13, 0.41, 'top')], segments=12, smooth=False)
    cart.rounded_box((0.33, 0.03, 1.427), (0.15, 0.15, 0.04), 'metal', radius=0.012, segments=2)
    cart.tube([(0.33, -0.134, 1.155), (0.33, -0.21, 1.155), (0.33, -0.21, 1.11)], 0.015, 'metal', sides=4)
    cart.rounded_box((0.33, -0.224, 1.11), (0.05, 0.018, 0.025), 'soft', radius=0.004, segments=1)
    cart.tube([(0.48, 0.26, 1.5), (0.56, 0.26, 2.025)], 0.025, 'metal', sides=6)
    for x in (-0.56, 0.56):
        cart.tube([(x, 0.3, 1.02), (x, 0.3, 1.85), (x * 1.08, 0.15, 2.03)], 0.013, 'metal', sides=4)
    curved_canopy(cart, 0.04, 2.07, 0.75, 0.41, 'soft')
    roof_sign(cart, z=1.89, y=-0.02)
    for x in (-0.45, 0.45):
        cart.tube([(x, 0.0, 2.04), (x, 0.0, 2.085)], 0.012, 'metal', sides=4)
    cart.tube([(-0.56, -0.286, 0.52), (0.56, -0.286, 0.52)], 0.014, 'strip', sides=4)
    cart.rounded_box((0, -0.262, 0.62), (0.68, 0.012, 0.05), 'trim', radius=0.003, segments=1)
    bmesh.ops.remove_doubles(cart.bm, verts=cart.bm.verts[:], dist=1e-6)
    return cart
