import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_kit import MATERIAL_ORDER, anchor, bake_isolated, finish_hero
from hero_road import build_road_parts

OUTPUT = sys.argv[sys.argv.index('--') + 1]
COLLISIONS = {
    'median_a': ((0.0, 0.0, 0.16), (2.0, 0.29, 0.16)),
    'median_b': ((0.0, 0.0, 0.40), (2.0, 0.40, 0.40)),
}


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    collection = scene.collection
    materials = [bpy.data.materials.new(name) for name in MATERIAL_ORDER]
    for material in materials:
        material.use_nodes = True

    built = {}
    for part in build_road_parts():
        built[part.name] = finish_hero(part, collection, materials)

    for name, (location, scale) in COLLISIONS.items():
        anchor(built[name], 'collision_main', collection, location, scale)

    bake_isolated(
        scene,
        collection,
        built,
        materials[0],
        'road-parts-lightmap',
        0.6,
        ground_for=lambda name: name.startswith('median_') or name.startswith('verge_'),
    )

    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            print('PART', ob.name, sum(len(p.vertices) - 2 for p in ob.data.polygons))
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT, compress=True)


main()
