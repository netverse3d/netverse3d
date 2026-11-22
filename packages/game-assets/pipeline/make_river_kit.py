import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_kit import anchor, bake_isolated, finish_hero
from hero_river import (
    build_deck,
    build_pier,
    build_pylon,
    build_quay,
    build_quaystep,
    build_ramp,
    build_water,
)

OUTPUT = sys.argv[sys.argv.index('--') + 1]
COLLISIONS = {
    'quay_a': ((0.0, -1.05, 2.125), (2.0, 0.18, 0.525)),
    'quaystep_a': ((0.0, 0.25, 1.0), (2.0, 1.5, 1.0)),
    'pier_a': ((0.0, 3.3, 0.45), (3.0, 0.35, 0.45)),
    'deck_a': ((0.0, 0.0, 1.2), (8.0, 3.4, 0.6)),
    'pylon_a': ((3.8, 2.2, 1.1), (2.3, 1.5, 1.1)),
    'ramp_a': ((0.0, 0.0, 0.7), (8.0, 3.4, 0.7)),
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
    builders = (
        build_water,
        build_quay,
        build_quaystep,
        build_pier,
        build_deck,
        build_pylon,
        build_ramp,
    )
    for builder in builders:
        part = builder()
        ob = finish_hero(part, collection, materials)
        built[part.name] = ob

    for name, (location, scale) in COLLISIONS.items():
        anchor(built[name], 'collision_main', collection, location, scale)

    bake_isolated(
        scene,
        collection,
        built,
        materials[0],
        'river-parts-lightmap',
        0.6,
        ground_for=lambda name: name != 'water_a',
    )

    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            print('PART', ob.name, sum(len(p.vertices) - 2 for p in ob.data.polygons))
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT, compress=True)


main()
