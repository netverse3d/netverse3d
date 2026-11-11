import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_chair import build_hero_chair
from hero_mic_boom import build_mic_boom
from hero_mouse import build_mouse_a, build_mouse_b, build_mouse_c
from hero_kit import anchor, attach_occlusion, bake_occlusion, context_copy, finish_hero, finish_lightmap_uv, ground_plane, lightmap_image, prepare_lightmap_uv, remove_context
from hero_desks import build_desk_a, build_desk_b, build_desk_c
from hero_headset import build_headset_a, build_headset_b, build_headset_c
from hero_keyboard import build_keyboard_a, build_keyboard_b, build_keyboard_c
from hero_station import build_case, build_mat, build_mic, build_monitor, build_speaker

OUTPUT = sys.argv[sys.argv.index('--') + 1]
LIGHTMAP_SIZE = 2048
DESK_TOP = 0.704
MAT_TOP = DESK_TOP + 0.004
SOCKETS = {
    'socket_monitor': (0, -0.62, DESK_TOP),
    'socket_keyboard': (0, -0.262, MAT_TOP),
    'socket_mouse': (-0.29, -0.265, MAT_TOP),
    'socket_mat': (-0.04, -0.27, DESK_TOP),
    'socket_chair': (0, 0.24, 0),
    'socket_case': (-0.46, -0.36, 0),
    'socket_headset': (0.62, -0.38, DESK_TOP),
    'socket_mic': (-0.62, -0.38, DESK_TOP),
    'socket_speaker_left': (0.5, -0.62, DESK_TOP),
    'socket_speaker_right': (-0.5, -0.62, DESK_TOP),
    'interact_point': (0, 0.95, 0),
}


def socket_of(part):
    slot = part.rsplit('_', 1)[0]
    return 'socket_speaker_left' if slot == 'speaker' else 'socket_' + slot


def bake_station(scene, collection, built, surface):
    parts = list(built.values())
    prepare_lightmap_uv(parts)
    ground = ground_plane(collection)
    image = lightmap_image('station-parts-lightmap', LIGHTMAP_SIZE)
    for ob in parts:
        for other in parts:
            other.hide_render = other is not ob
        bake_occlusion(scene, [ob], image, distance=0.3)
    for ob in parts:
        ob.hide_render = False
    remove_context([ground])
    finish_lightmap_uv(parts)
    attach_occlusion(surface, image)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.scene.new(type='EMPTY') if not bpy.data.scenes else None
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    collection = scene.collection
    materials = [bpy.data.materials.new(name) for name in ('surface', 'glow', 'display', 'decal', 'legend')]
    for material in materials:
        material.use_nodes = True
    builders = [build_desk_a, build_desk_b, build_desk_c, build_hero_chair, build_monitor, build_case, build_keyboard_a, build_keyboard_b, build_keyboard_c, build_mouse_a, build_mouse_b, build_mouse_c, build_headset_a, build_headset_b, build_headset_c, build_mic, build_mic_boom, build_speaker, build_mat]
    built = {}
    for builder in builders:
        part = builder()
        built[part.name] = finish_hero(part, collection, materials)
    for desk in ('desk_a', 'desk_b', 'desk_c'):
        for name, location in SOCKETS.items():
            anchor(built[desk], name, collection, location)
        anchor(built[desk], 'collision_main', collection, (0, -0.46, 0.36), (0.76, 0.35, 0.36))
    anchor(built['chair_a'], 'seat_anchor', collection, (0, -0.24, 0))
    anchor(built['chair_a'], 'collision_main', collection, (0, 0.03, 0.665), (0.32, 0.33, 0.665))
    anchor(built['case_a'], 'collision_main', collection, (0, 0, 0.29), (0.13, 0.235, 0.29))
    bake_station(scene, collection, built, materials[0])
    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            print('PART', ob.name, sum(len(p.vertices) - 2 for p in ob.data.polygons))
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT, compress=True)


main()
