import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_kit import anchor, bake_isolated, finish_hero
from hero_stall import build_cart_a, build_cart_b

OUTPUT = sys.argv[sys.argv.index('--') + 1]


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
    for builder in (build_cart_a, build_cart_b):
        part = builder()
        built[part.name] = finish_hero(part, collection, materials)
    for part in built.values():
        anchor(part, 'collision_main', collection, (0, 0, 1.03), (0.68, 0.4, 1.03))
    bake_isolated(scene, collection, built, materials[0], 'stall-parts-lightmap', 0.4)
    for part in built.values():
        part.data.uv_layers.active = part.data.uv_layers['lightmap']
    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            print('PART', ob.name, sum(len(p.vertices) - 2 for p in ob.data.polygons))
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT, compress=True)


main()
