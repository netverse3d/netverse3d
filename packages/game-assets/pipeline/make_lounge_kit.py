import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_kit import anchor, bake_isolated, finish_hero
from hero_lounge import TABLE_TOP, build_console, build_gamepad, build_sofa, build_table, build_tv

OUTPUT = sys.argv[sys.argv.index('--') + 1]
SOCKETS = {
    'socket_console': (0.22, 0.0, TABLE_TOP),
    'socket_gamepad': (-0.22, 0.08, TABLE_TOP),
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
    for builder in (build_sofa, build_table, build_console, build_gamepad, build_tv):
        part = builder()
        built[part.name] = finish_hero(part, collection, materials)
    for name, location in SOCKETS.items():
        anchor(built['table_a'], name, collection, location)
    anchor(built['table_a'], 'collision_main', collection, (0, 0, 0.21), (0.55, 0.3, 0.21))
    anchor(built['sofa_a'], 'collision_main', collection, (0, 0.0, 0.45), (0.95, 0.45, 0.45))
    anchor(built['tv_a'], 'collision_main', collection, (0, 0, 0.46), (0.73, 0.11, 0.46))
    bake_isolated(scene, collection, built, materials[0], 'lounge-parts-lightmap', 0.4)
    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            print('PART', ob.name, sum(len(p.vertices) - 2 for p in ob.data.polygons))
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT, compress=True)


main()
