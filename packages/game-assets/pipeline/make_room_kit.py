import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_kit import HeroPart, anchor, attach_occlusion, bake_occlusion, context_copy, finish_hero, finish_lightmap_uv, lightmap_image, prepare_lightmap_uv, preview_requested, remove_context, rounded_rect

OUTPUT = sys.argv[sys.argv.index('--') + 1]
CELL = 2.0
HEIGHT = 3.0
FACE_Y = -0.8
LIGHTMAP_SIZE = 2048
BESIDE_WALLS = [('floor_a', (0, 0, 0), 0.0), ('wall_a', (CELL, 0, 0), 0.0), ('wall_a', (-CELL, 0, 0), 0.0)]
BAKE_CONTEXT = {
    'wall_a': BESIDE_WALLS,
    'door_a': BESIDE_WALLS,
    'window_a': BESIDE_WALLS,
    'corner_a': [('floor_a', (0, 0, 0), 0.0), ('wall_a', (CELL, 0, 0), 0.0), ('wall_a', (0, CELL, 0), -math.pi / 2)],
    'marker_a': [('floor_a', (0, 0, 0), 0.0)],
}


PANEL_HALF = 0.255
PILASTER_HALF = 0.06
PILASTER_Z = (0.4, 2.48)
POST = 0.32
CORNER_END = 1.0 - POST


def wall_dressing(part, x_range, plate_inset=(0.0, 0.0)):
    x0, x1 = x_range
    centre, width = (x0 + x1) / 2, x1 - x0
    p0, p1 = x0 + plate_inset[0], x1 - plate_inset[1]
    part.rounded_box((centre, FACE_Y + 0.04, 0.2), (width, 0.08, 0.4), 'trim', radius=0.012, segments=1)
    part.rounded_box((centre, FACE_Y + 0.06, 2.8), (width, 0.12, 0.4), 'wall', radius=0.014, segments=1)
    part.rounded_box((centre, FACE_Y + 0.05, 2.54), (width, 0.1, 0.12), 'strip', radius=0.004, segments=1)
    part.rounded_box(((p0 + p1) / 2, FACE_Y + 0.082, 0.43), (p1 - p0, 0.016, 0.05), 'screen', radius=0.004, segments=1)


def inside(x, half, x_range, slack=0.01):
    return x_range[0] - slack <= x - half and x + half <= x_range[1] + slack


def panel_ranges(x_range, gap=0.01, minimum=0.2):
    ranges = []
    for x in (-0.54, 0.0, 0.54):
        x0, x1 = max(x - PANEL_HALF, x_range[0] + gap), min(x + PANEL_HALF, x_range[1] - gap)
        if x1 - x0 >= minimum:
            ranges.append((x0, x1))
    return ranges


def wall_arm(part, x_range=(-1.0, 1.0), pilasters=(-0.94, 0.94)):
    x0, x1 = x_range
    centre, width = (x0 + x1) / 2, x1 - x0
    part.rounded_box((centre, -0.9, HEIGHT / 2), (width, 0.2, HEIGHT), 'wall', radius=0.002, segments=1)
    for p0, p1 in panel_ranges(x_range):
        part.slab_y((p0 + p1) / 2, 1.45, (p1 - p0) / 2, 0.98, 0.012, [
            (FACE_Y - 0.002, 0.0, 'wall'),
            (FACE_Y + 0.03, 0.0, 'wall'),
            (FACE_Y + 0.042, 0.012, 'wall'),
        ], corner=1)
    pilaster_at = lambda edge: PILASTER_HALF * 2 if any(abs(x - edge) <= PILASTER_HALF + 0.001 for x in pilasters) else 0.0
    wall_dressing(part, x_range, plate_inset=(pilaster_at(x0), pilaster_at(x1)))
    part.tube([(max(-0.82, x0 + 0.18), FACE_Y + 0.044, 1.42), (min(0.82, x1 - 0.18), FACE_Y + 0.044, 1.42)], 0.005, 'soft', sides=3)
    z0, z1 = PILASTER_Z
    for x in pilasters:
        part.rounded_box((x, FACE_Y + 0.05, (z0 + z1) / 2), (PILASTER_HALF * 2, 0.1, z1 - z0), 'wall', radius=0.012, segments=1)
    for x in (-0.54, 0.54):
        if not inside(x, 0.11, x_range):
            continue
        for offset in (0.0, 0.05):
            z = 0.15 + offset
            part.poly([(x - 0.11, FACE_Y + 0.082, z), (x + 0.11, FACE_Y + 0.082, z), (x + 0.11, FACE_Y + 0.082, z + 0.018), (x - 0.11, FACE_Y + 0.082, z + 0.018)][::-1], 'soft')


def build_floor():
    floor = HeroPart('floor_a')
    floor.rounded_box((0, 0, -0.05), (CELL, CELL, 0.06), 'body', radius=0.002, segments=1)
    for x in (-0.5, 0.5):
        for y in (-0.5, 0.5):
            floor.slab(x, y, 0.49, 0.49, 0.016, [
                (-0.03, 0.0, 'floor'),
                (-0.006, 0.0, 'floor'),
                (0.0, 0.008, 'floor'),
                (0.0002, 0.012, 'floor'),
            ], corner=1)
    for side in (-1, 1):
        y = side * 0.975
        floor.poly([(-0.22, y - 0.018, 0.0022), (0.22, y - 0.018, 0.0022), (0.22, y + 0.018, 0.0022), (-0.22, y + 0.018, 0.0022)], 'screen')
        x = side * 0.975
        floor.poly([(x - 0.018, -0.22, 0.0022), (x + 0.018, -0.22, 0.0022), (x + 0.018, 0.22, 0.0022), (x - 0.018, 0.22, 0.0022)], 'screen')
    return floor


def build_wall():
    wall = HeroPart('wall_a')
    wall_arm(wall)
    return wall


def build_corner():
    corner = HeroPart('corner_a')
    wall_arm(corner, x_range=(-1.0, CORNER_END), pilasters=(-0.94,))
    bmesh.ops.rotate(corner.bm, verts=list(corner.bm.verts), cent=(0, 0, 0), matrix=Matrix.Rotation(-math.pi / 2, 3, 'Z'))
    wall_arm(corner, x_range=(-CORNER_END, 1.0), pilasters=(0.94,))
    post = -1.0 + POST / 2
    corner.rounded_box((post, post, HEIGHT / 2), (POST, POST, HEIGHT), 'wall', radius=0.012, segments=1)
    return corner


def build_door():
    door = HeroPart('door_a')
    for x in (-0.88, 0.88):
        door.rounded_box((x, -0.9, HEIGHT / 2), (0.24, 0.2, HEIGHT), 'wall', radius=0.002, segments=1)
        door.rounded_box((x, FACE_Y + 0.06, 1.34), (0.24, 0.12, 2.12), 'wall', radius=0.014, segments=1)
    door.rounded_box((0, -0.9, 2.65), (1.52, 0.2, 0.7), 'wall', radius=0.002, segments=1)
    door.rounded_box((0, FACE_Y + 0.06, 2.72), (CELL, 0.12, 0.56), 'wall', radius=0.014, segments=1)
    door.rounded_box((0, FACE_Y + 0.124, 2.76), (1.0, 0.012, 0.16), 'screen', radius=0.006, segments=1)
    door.rounded_box((0, FACE_Y + 0.124, 2.5), (1.5, 0.012, 0.04), 'strip', radius=0.004, segments=1)
    for x in (-0.765, 0.765):
        door.tube([(x, FACE_Y + 0.05, 0.03), (x, FACE_Y + 0.05, 2.42)], 0.016, 'strip', sides=4)
    for sign in (-1, 1):
        center = sign * 0.38
        door.rounded_box((center, -0.9, 1.16), (0.76, 0.05, 2.28), 'body', radius=0.004, segments=1)
        x0, x1 = center - 0.325, center + 0.325
        door.poly([(x0, -0.873, 0.1), (x1, -0.873, 0.1), (x1, -0.873, 2.22), (x0, -0.873, 2.22)][::-1], 'display')
        door.tube([(center - sign * 0.29, -0.86, 0.9), (center - sign * 0.29, -0.86, 1.4)], 0.013, 'metal', sides=4)
    for x in (-0.88, 0.88):
        door.rounded_box((x, FACE_Y + 0.07, 0.14), (0.24, 0.14, 0.28), 'top', radius=0.014, segments=1)
        door.tube([(x - 0.07, FACE_Y + 0.1215, 0.36), (x + 0.07, FACE_Y + 0.1215, 0.36), (x + 0.07, FACE_Y + 0.1215, 2.3), (x - 0.07, FACE_Y + 0.1215, 2.3), (x - 0.07, FACE_Y + 0.1215, 0.36)], 0.004, 'soft', sides=3)
    door.rounded_box((0.88, FACE_Y + 0.13, 1.25), (0.15, 0.016, 0.28), 'metal', radius=0.006, segments=1)
    door.rounded_box((0.88, FACE_Y + 0.14, 1.28), (0.11, 0.004, 0.17), 'screen', radius=0.003, segments=1)
    return door


def build_window():
    window = HeroPart('window_a')
    for x in (-0.92, 0.92):
        window.rounded_box((x, -0.9, HEIGHT / 2), (0.16, 0.2, HEIGHT), 'wall', radius=0.002, segments=1)
    window.rounded_box((0, -0.9, 0.36), (1.68, 0.2, 0.72), 'wall', radius=0.002, segments=1)
    window.rounded_box((0, -0.9, 2.675), (1.68, 0.2, 0.65), 'wall', radius=0.002, segments=1)
    wall_dressing(window, (-1.0, 1.0))
    window.poly([(-0.84, -0.87, 0.72), (0.84, -0.87, 0.72), (0.84, -0.87, 2.35), (-0.84, -0.87, 2.35)][::-1], 'display')
    for x in (-0.28, 0.28):
        window.rounded_box((x, -0.85, 1.535), (0.07, 0.06, 1.63), 'top', radius=0.006, segments=1)
    window.rounded_box((0, -0.74, 0.68), (1.96, 0.18, 0.12), 'wall', radius=0.016, segments=1)
    for x in (-0.86, 0.86):
        window.rounded_box((x, -0.8, 1.535), (0.08, 0.14, 1.71), 'wall', radius=0.008, segments=1)
    window.rounded_box((0, -0.8, 2.38), (1.64, 0.14, 0.08), 'wall', radius=0.008, segments=1)
    return window


def build_ceiling():
    ceiling = HeroPart('ceiling_a')
    ceiling.rounded_box((0, 0, HEIGHT + 0.03), (CELL, CELL, 0.06), 'ceiling', radius=0.002, segments=1)
    profile = [(0.74, 2.66, 'top'), (0.74, 2.80, 'top'), (0.52, 2.80, 'strip'), (0.52, 2.66, 'strip'), (0.70, 2.66, 'top')]
    rings = [[Vector((x, y, z)) for x, y in rounded_rect(0, 0, half, half, 0.06, 2)] for half, z, _ in profile]
    ceiling.loft(rings + [rings[0]], lambda r, c: profile[r][2], levels=0, cap=False, smooth=False)
    for x, y in ((-0.6, -0.6), (0.6, 0.6)):
        ceiling.tube([(x, y, 2.8), (x, y, HEIGHT + 0.002)], 0.016, 'metal', sides=4)
    return ceiling


def build_light():
    light = HeroPart('light_a')
    light.tube([(-0.5, 0.1, 0.062), (0.5, 0.1, 0.062)], 0.05, 'strip', sides=8)
    for x in (-0.53, 0.53):
        light.rounded_box((x, 0.082, 0.062), (0.1, 0.116, 0.124), 'metal', radius=0.018, segments=1)
        light.rounded_box((x * 0.985, 0.012, 0.062), (0.12, 0.024, 0.12), 'body', radius=0.008, segments=1)
    return light


def build_marker():
    marker = HeroPart('marker_a')
    marker.revolve((0, 0, 0), 'z', [
        (0.47, 0.0, 'body'),
        (0.47, 0.018, 'accent'),
        (0.455, 0.03, 'body'),
        (0.42, 0.04, 'top'),
        (0.3, 0.04, 'soft'),
        (0.001, 0.04, 'soft'),
    ], segments=24, smooth=False)
    radius = 0.36
    for start in (20, 110, 200, 290):
        arc = [(radius * math.cos(math.radians(start + a)), radius * math.sin(math.radians(start + a)), 0.043) for a in range(0, 61, 12)]
        marker.tube(arc, 0.016, 'screen', sides=3)
    half = 0.17
    marker.image_quad([(-half, -half, 0.042), (half, -half, 0.042), (half, half, 0.042), (-half, half, 0.042)], 'decal')
    return marker


def bake_room(scene, collection, built, surface):
    parts = list(built.values())
    prepare_lightmap_uv(parts)
    if preview_requested():
        finish_lightmap_uv(parts)
        attach_occlusion(surface, lightmap_image('room-kit-lightmap-preview', 16))
        return
    image = lightmap_image('room-kit-lightmap', LIGHTMAP_SIZE)
    for name, ob in built.items():
        for other in parts:
            other.hide_render = other is not ob
        context = [context_copy(collection, built[other], location, yaw) for other, location, yaw in BAKE_CONTEXT.get(name, [])]
        bake_occlusion(scene, [ob], image)
        remove_context(context)
    for ob in parts:
        ob.hide_render = False
    finish_lightmap_uv(parts)
    attach_occlusion(surface, image)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    collection = scene.collection
    materials = [bpy.data.materials.new(name) for name in ('surface', 'glow', 'display', 'decal', 'legend')]
    for material in materials:
        material.use_nodes = True
    builders = [build_floor, build_wall, build_corner, build_door, build_window, build_ceiling, build_light, build_marker]
    built = {}
    for builder in builders:
        part = builder()
        built[part.name] = finish_hero(part, collection, materials)
    wall_box = ((0, -0.9, 1.5), (1.0, 0.1, 1.5))
    anchor(built['wall_a'], 'collision_main', collection, *wall_box)
    anchor(built['window_a'], 'collision_main', collection, *wall_box)
    anchor(built['corner_a'], 'collision_a', collection, *wall_box)
    anchor(built['corner_a'], 'collision_b', collection, (-0.9, 0, 1.5), (0.1, 1.0, 1.5))
    anchor(built['door_a'], 'collision_left', collection, (-0.88, -0.9, 1.5), (0.12, 0.1, 1.5))
    anchor(built['door_a'], 'collision_right', collection, (0.88, -0.9, 1.5), (0.12, 0.1, 1.5))
    bake_room(scene, collection, built, materials[0])
    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            print('PART', ob.name, sum(len(p.vertices) - 2 for p in ob.data.polygons))
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT, compress=True)


main()
