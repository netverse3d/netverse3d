import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_kit import MATERIAL_ORDER, anchor, bake_isolated, finish_hero
from hero_midrise import build_midrise_parts

OUTPUT = sys.argv[sys.argv.index('--') + 1]
COLLISIONS = {
    'midrise_ground_a': (('collision_main', (0, 0.16, 2), (2, 0.16, 2)),),
    'midrise_ground_b': (('collision_main', (0, 0.16, 2), (2, 0.16, 2)),),
}


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    collection = scene.collection
    materials = [bpy.data.materials.new(name) for name in MATERIAL_ORDER]
    for material in materials:
        material.use_nodes = True
    parts = build_midrise_parts()
    built = {part.name: finish_hero(part, collection, materials) for part in parts}
    for name, boxes in COLLISIONS.items():
        for label, location, scale in boxes:
            anchor(built[name], label, collection, location, scale)
    bake_isolated(scene, collection, built, materials[0], 'midrise-parts-lightmap', 0.65)
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT, compress=True)


main()
