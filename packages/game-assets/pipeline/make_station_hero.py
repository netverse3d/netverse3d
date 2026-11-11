import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_cases import CASE_COLLISIONS, build_case_b, build_case_c
from hero_chair import build_hero_chair
from hero_chairs import CHAIR_COLLISIONS, SEAT_ANCHOR, build_chair_mesh, build_chair_task
from hero_mic_boom import build_mic_boom
from hero_mouse import build_mouse_a, build_mouse_b, build_mouse_c
from hero_kit import anchor, bake_isolated, finish_hero
from hero_desks import build_desk_a, build_desk_b, build_desk_c
from hero_headset import build_headset_a, build_headset_b, build_headset_c
from hero_keyboard import build_keyboard_a, build_keyboard_b, build_keyboard_c, build_keyboard_d, build_keyboard_e, build_keyboard_f
from hero_mats import build_mat_a, build_mat_b, build_mat_c
from hero_speakers import CENTER_MOUNT, build_speaker, build_speaker_bar
from hero_station import build_case, build_mic, build_monitor, build_monitor_curved, build_monitor_retro

OUTPUT = sys.argv[sys.argv.index('--') + 1]
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
    'socket_speaker_center': (0, -0.495, DESK_TOP),
    'interact_point': (0, 0.95, 0),
}


def socket_of(part):
    slot = part.rsplit('_', 1)[0]
    return 'socket_speaker_left' if slot == 'speaker' else 'socket_' + slot


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
    builders = [build_desk_a, build_desk_b, build_desk_c, build_hero_chair, build_chair_mesh, build_chair_task, build_monitor, build_monitor_curved, build_monitor_retro, build_case, build_case_b, build_case_c, build_keyboard_a, build_keyboard_b, build_keyboard_c, build_keyboard_d, build_keyboard_e, build_keyboard_f, build_mouse_a, build_mouse_b, build_mouse_c, build_headset_a, build_headset_b, build_headset_c, build_mic, build_mic_boom, build_speaker, build_speaker_bar, build_mat_a, build_mat_b, build_mat_c]
    built = {}
    for builder in builders:
        part = builder()
        built[part.name] = finish_hero(part, collection, materials)
    for desk in ('desk_a', 'desk_b', 'desk_c'):
        for name, location in SOCKETS.items():
            anchor(built[desk], name, collection, location)
        anchor(built[desk], 'collision_main', collection, (0, -0.46, 0.36), (0.76, 0.35, 0.36))
    for name, (center, half) in CHAIR_COLLISIONS.items():
        anchor(built[name], 'seat_anchor', collection, SEAT_ANCHOR)
        anchor(built[name], 'collision_main', collection, center, half)
    anchor(built['speaker_b'], CENTER_MOUNT, collection, (0, 0, 0))
    for name, (center, half) in CASE_COLLISIONS.items():
        anchor(built[name], 'collision_main', collection, center, half)
    bake_isolated(scene, collection, built, materials[0], 'station-parts-lightmap', 0.3)
    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            print('PART', ob.name, sum(len(p.vertices) - 2 for p in ob.data.polygons))
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT, compress=True)


main()
