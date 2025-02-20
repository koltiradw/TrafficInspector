from environs import Env

env = Env()
env.read_env()

PSQL_ENGINE = env.str('PSQL_ENGINE', default='')
BACKEND_PORT = env.str('BACKEND_PORT', default='')
API_PAGINATION_SIZE = 50
