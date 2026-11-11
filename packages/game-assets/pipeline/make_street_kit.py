import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_kit import anchor, bake_isolated, finish_hero
from hero_facade import build_roof, build_shopfront, build_storey_a, build_storey_b
from hero_street import build_bin, build_lamp, build_planter, build_pole, build_road_a, build_road_b, build_road_c, build_board, build_sidewalk, build_wires

OUTPUT = sys.argv[sys.argv.index('--') + 1]
COLLISIONS = {
    'pole_a': ((0, 0, 3.5), (0.15, 0.15, 3.5)),
    'lamp_a': ((0, 0, 2.1), (0.11, 0.11, 2.1)),
    'bin_a': ((0, 0, 0.4), (0.25, 0.25, 0.4)),
    'planter_a': ((0, 0, 0.5), (0.4, 0.4, 0.5)),
    'board_a': ((0, 0, 0.5), (0.32, 0.32, 0.5)),
    'shopfront_a': ((0, 0, 1.7), (2.0, 0.15, 1.7)),
    'storey_a': ((0, 0, 1.7), (2.0, 0.15, 1.7)),
    'storey_b': ((0, 0, 1.7), (2.0, 0.15, 1.7)),
    'roof_a': ((0, 0, 0.35), (2.0, 0.15, 0.35)),
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
    for builder in (build_road_a, build_road_b, build_road_c, build_sidewalk, build_pole, build_wires, build_lamp, build_bin, build_planter, build_board, build_shopfront, build_storey_a, build_storey_b, build_roof):
        part = builder()
        built[part.name] = finish_hero(part, collection, materials)
    for name, (location, scale) in COLLISIONS.items():
        anchor(built[name], 'collision_main', collection, location, scale)
    bake_isolated(scene, collection, built, materials[0], 'street-parts-lightmap', 0.6, ground_for=lambda name: not name.startswith('road_'))
    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            print('PART', ob.name, sum(len(p.vertices) - 2 for p in ob.data.polygons))
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT, compress=True)


main()
