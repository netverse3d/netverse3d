import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_kit import anchor, bake_isolated, finish_hero
from hero_vehicles import build_car_a, build_car_b, build_motorbike_a, build_motorbike_b

OUTPUT = sys.argv[sys.argv.index('--') + 1]

COLLISIONS = {
    'motorbike_a': ((0, 0, 0.55), (0.34, 0.95, 0.55)),
    'motorbike_b': ((0, 0, 0.56), (0.35, 0.96, 0.56)),
    'car_a': ((0, 0, 0.73), (0.92, 2.20, 0.73)),
    'car_b': ((0, 0, 0.86), (0.96, 2.36, 0.86)),
}

RIDER_SOCKETS = {
    'motorbike_a': (0, 0.08, 0.76),
    'motorbike_b': (0, 0.12, 0.77),
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
    for builder in (build_motorbike_a, build_motorbike_b, build_car_a, build_car_b):
        part, children = builder()
        parent_ob = finish_hero(part, collection, materials)
        built[part.name] = parent_ob
        parents[part.name] = [parent_ob]
        for child_part, location in children:
            child_ob = finish_hero(child_part, collection, materials)
            child_ob.parent = parent_ob
            child_ob.location = location
            built[child_part.name] = child_ob
            parents[part.name].append(child_ob)
    for name, (location, scale) in COLLISIONS.items():
        anchor(built[name], 'collision_main', collection, location, scale)
    for name, location in RIDER_SOCKETS.items():
        anchor(built[name], 'socket_rider', collection, location)
    bake_isolated(
        scene,
        collection,
        built,
        materials[0],
        'vehicle-parts-lightmap',
        0.6,
        ground_for=lambda name: '_wheel_' not in name,
    )
    for name, group in parents.items():
        total = sum(sum(len(p.vertices) - 2 for p in ob.data.polygons) for ob in group)
        print('PART', name, total, 'meshes', len(group))
    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            print('MESH', ob.name, sum(len(p.vertices) - 2 for p in ob.data.polygons))
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT, compress=True)


main()
