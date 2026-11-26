import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_kit import anchor, bake_isolated, finish_hero
from hero_traffic import (
    build_camera,
    build_roadsign_rect,
    build_roadsign_round,
    build_roadsign_triangle,
    build_signal,
    build_streetlight_double,
    build_streetlight_single,
    build_walk,
)

OUTPUT = sys.argv[sys.argv.index('--') + 1]
COLLISIONS = {
    'signal_a': ((0, 0, 2.2), (0.22, 0.22, 2.2)),
    'walk_a': ((0, 0, 1.25), (0.16, 0.16, 1.25)),
    'roadsign_a': ((0, 0, 1.25), (0.14, 0.14, 1.25)),
    'roadsign_b': ((0, 0, 1.25), (0.14, 0.14, 1.25)),
    'roadsign_c': ((0, 0, 1.25), (0.14, 0.14, 1.25)),
    'streetlight_a': ((0, 0, 2.5), (0.22, 0.22, 2.5)),
    'streetlight_b': ((0, 0, 2.5), (0.22, 0.22, 2.5)),
    'camera_a': ((0.06, 0, 1.25), (0.4, 0.24, 1.25)),
}


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    collection = scene.collection
    materials = [bpy.data.materials.new(name) for name in ('surface', 'glow', 'display', 'decal', 'legend')]
    for material in materials:
        material.use_nodes = True

    built = {}
    parents = {}
    child_links = []

    for builder in (build_signal, build_walk, build_streetlight_single, build_streetlight_double):
        parent_part, child_parts = builder()
        parent_ob = finish_hero(parent_part, collection, materials)
        built[parent_part.name] = parent_ob
        parents[parent_part.name] = parent_ob
        for child_part in child_parts:
            child_ob = finish_hero(child_part, collection, materials)
            built[child_part.name] = child_ob
            child_links.append((child_ob, parent_ob))

    for builder in (
        build_roadsign_round,
        build_roadsign_triangle,
        build_roadsign_rect,
        build_camera,
    ):
        part = builder()
        ob = finish_hero(part, collection, materials)
        built[part.name] = ob
        parents[part.name] = ob

    for name, (location, scale) in COLLISIONS.items():
        anchor(parents[name], 'collision_main', collection, location, scale)

    bake_isolated(
        scene,
        collection,
        built,
        materials[0],
        'traffic-parts-lightmap',
        0.6,
        ground_for=lambda name: name in parents,
    )

    for child_ob, parent_ob in child_links:
        child_ob.parent = parent_ob

    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            print('PART', ob.name, sum(len(p.vertices) - 2 for p in ob.data.polygons))
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT, compress=True)


main()
