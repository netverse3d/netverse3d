from hero_kit import HeroPart, rounded_rect

PLAIN_LAYERS = [(0.0, 0.0, 'body'), (0.003, 0.0015, 'soft'), (0.0036, 0.004, 'soft')]


def build_mat_a(name='mat_a'):
    mat = HeroPart(name)
    mat.slab(0, 0, 0.425, 0.175, 0.024, [
        (0.0, 0.0, 'body'),
        (0.0035, 0.002, 'soft'),
    ])
    border = [(x, y, 0.0045) for x, y in rounded_rect(0, 0, 0.415, 0.165, 0.02, 3)]
    mat.tube(border, 0.007, 'strip', sides=4, closed=True)
    mat.image_quad([(0.325, -0.14, 0.0055), (0.395, -0.14, 0.0055), (0.395, -0.08, 0.0055), (0.325, -0.08, 0.0055)], 'decal')
    return mat


def build_mat_b(name='mat_b'):
    mat = HeroPart(name)
    mat.slab(0, 0, 0.4, 0.175, 0.02, PLAIN_LAYERS)
    return mat


def build_mat_c(name='mat_c'):
    mat = HeroPart(name)
    mat.slab(-0.25, 0.005, 0.13, 0.11, 0.015, PLAIN_LAYERS)
    return mat
