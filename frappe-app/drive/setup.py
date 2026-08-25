from setuptools import setup, find_packages

setup(
    name="drive",
    version="0.1.0",
    description="DRIVE — Doorstep Incubation for Thriving Enterprises",
    author="Sauramandala Foundation",
    author_email="nk@sauramandala.org",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=["frappe"],
)
