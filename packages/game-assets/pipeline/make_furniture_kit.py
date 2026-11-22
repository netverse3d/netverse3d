import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_furniture import (
    build_adpillar,
    build_bench,
    build_binpair,
    build_bollard,
    build_cabinet,
    build_hydrant,
    build_manhole,
    build_railing,
    build_shelter,
)
from hero_kit import anchor, bake_isolated, finish_hero

OUTPUT = sys.argv[sys.argv.index('--') + 1]
COLLISIONS = {
    'shelter_a': ((0.0, 0.10, 1.26), (1.80, 0.50, 1.26)),
    'bench_a': ((0.0, 0.02, 0.40), (0.95, 0.30, 0.40)),
    'railing_a': ((0.0, 0.0, 0.48), (1.00, 0.08, 0.48)),
    'bollard_a': ((0.0, 0.0, 0.45), (0.13, 0.13, 0.45)),
    'binpair_a': ((0.0, 0.0, 0.51), (0.46, 0.22, 0.51)),
    'cabinet_a': ((0.0, 0.0, 0.65), (0.41, 0.24, 0.65)),
    'hydrant_a': ((0.0, -0.02, 0.40), (0.29, 0.24, 0.40)),
    'adpillar_a': ((0.0, 0.0, 1.46), (0.62, 0.19, 1.46)),
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
        build_shelter,
        build_bench,
        build_railing,
        build_bollard,
        build_binpair,
        build_cabinet,
        build_hydrant,
        build_manhole,
        build_adpillar,
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
        'furniture-parts-lightmap',
        0.6,
        ground_for=lambda name: True,
    )

    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            print('PART', ob.name, sum(len(p.vertices) - 2 for p in ob.data.polygons))
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT, compress=True)


main()
