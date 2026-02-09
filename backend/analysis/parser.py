"""Tree-sitter AST parser for extracting code structures from source files."""

import logging
from dataclasses import dataclass, field
from pathlib import Path

import tree_sitter_language_pack as tslp

from backend.analysis.languages import GRAMMAR_NAMES, LANGUAGE_CONFIGS
from backend.utils import get_language, hash_code

logger = logging.getLogger(__name__)

# Cache parsers per language
_parsers: dict[str, object] = {}


def get_parser(language: str):
    """Get or create a tree-sitter parser for a language."""
    if language not in _parsers:
        grammar_name = GRAMMAR_NAMES.get(language)
        if not grammar_name:
            raise ValueError(f"Unsupported language: {language}")
        _parsers[language] = tslp.get_parser(grammar_name)
    return _parsers[language]


@dataclass
class ParsedClass:
    name: str
    file_path: str
    language: str
    line_start: int
    line_end: int
    code: str
    code_hash: str
    methods: list[str] = field(default_factory=list)
    superclasses: list[str] = field(default_factory=list)
    attributes: list[str] = field(default_factory=list)


@dataclass
class ParsedFunction:
    name: str
    file_path: str
    language: str
    line_start: int
    line_end: int
    code: str
    code_hash: str
    params: list[str] = field(default_factory=list)
    calls: list[str] = field(default_factory=list)
    parent_class: str | None = None


@dataclass
class ParsedVariable:
    name: str
    file_path: str
    language: str
    line_start: int
    line_end: int
    code: str
    code_hash: str
    scope: str = "module"  # module/class/param


@dataclass
class ParsedImport:
    name: str
    file_path: str
    language: str
    line_start: int
    line_end: int
    code: str
    source: str = ""
    is_external: bool = False


@dataclass
class FileParseResult:
    file_path: str
    language: str
    classes: list[ParsedClass] = field(default_factory=list)
    functions: list[ParsedFunction] = field(default_factory=list)
    variables: list[ParsedVariable] = field(default_factory=list)
    imports: list[ParsedImport] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def _get_node_text(node, source_bytes: bytes) -> str:
    """Extract text from a tree-sitter node."""
    return source_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _find_child_by_field(node, field_name: str):
    """Find a child node by field name."""
    return node.child_by_field_name(field_name)


def _find_children_by_type(node, type_name: str) -> list:
    """Find all children of a given type recursively."""
    results = []
    for child in node.children:
        if child.type == type_name:
            results.append(child)
        results.extend(_find_children_by_type(child, type_name))
    return results


def _extract_name(node, source_bytes: bytes, config: dict) -> str:
    """Extract the name from a node using language-specific config."""
    name_field = config.get("name_field", "name")
    name_node = _find_child_by_field(node, name_field)
    if name_node:
        # For C/C++ function declarators, dig deeper
        if name_node.type in ("function_declarator", "pointer_declarator"):
            inner = _find_child_by_field(name_node, "declarator")
            if inner:
                return _get_node_text(inner, source_bytes)
        return _get_node_text(name_node, source_bytes)
    # Fallback: try first identifier child
    for child in node.children:
        if child.type == "identifier":
            return _get_node_text(child, source_bytes)
    return "<anonymous>"


def _extract_calls(node, source_bytes: bytes, call_types: list[str]) -> list[str]:
    """Extract all function/method calls within a node."""
    calls = set()
    for call_node in _find_children_by_type(node, call_types[0] if call_types else "call_expression"):
        func = _find_child_by_field(call_node, "function") or _find_child_by_field(call_node, "name")
        if func:
            text = _get_node_text(func, source_bytes)
            # Extract just the function name from attribute access (e.g., obj.method -> method)
            if "." in text:
                text = text.split(".")[-1]
            calls.add(text)
        else:
            # Try first child
            if call_node.children:
                text = _get_node_text(call_node.children[0], source_bytes)
                if "." in text:
                    text = text.split(".")[-1]
                calls.add(text)
    return list(calls)


def _extract_params(node, source_bytes: bytes, config: dict) -> list[str]:
    """Extract parameter names from a function node."""
    params = []
    params_node = _find_child_by_field(node, config.get("params_field", "parameters"))
    if params_node:
        for child in params_node.children:
            if child.type in ("identifier", "typed_parameter", "typed_default_parameter",
                              "default_parameter", "formal_parameter", "parameter",
                              "simple_parameter", "required_parameter"):
                name_node = _find_child_by_field(child, "name")
                if name_node:
                    params.append(_get_node_text(name_node, source_bytes))
                elif child.type == "identifier":
                    params.append(_get_node_text(child, source_bytes))
    return params


def _extract_superclasses(node, source_bytes: bytes, config: dict) -> list[str]:
    """Extract superclass names from a class node."""
    superclasses = []
    field_name = config.get("superclass_field")
    if not field_name:
        return superclasses

    super_node = _find_child_by_field(node, field_name)
    if super_node:
        # Handle argument_list (Python), or direct identifiers
        for child in super_node.children:
            if child.type in ("identifier", "type_identifier", "scoped_identifier",
                              "scoped_type_identifier", "generic_type"):
                superclasses.append(_get_node_text(child, source_bytes))
            elif child.type == "argument_list":
                for arg in child.children:
                    if arg.type in ("identifier", "attribute"):
                        superclasses.append(_get_node_text(arg, source_bytes))
    return superclasses


def _extract_import_source(node, source_bytes: bytes, language: str) -> tuple[str, str]:
    """Extract import name and source module."""
    text = _get_node_text(node, source_bytes).strip()
    name = text
    source = ""

    if language == "python":
        if node.type == "import_from_statement":
            module_node = _find_child_by_field(node, "module_name")
            if module_node:
                source = _get_node_text(module_node, source_bytes)
                name = source
        else:
            # Regular import
            for child in node.children:
                if child.type in ("dotted_name", "aliased_import"):
                    name = _get_node_text(child, source_bytes)
                    source = name
                    break
    elif language in ("javascript", "typescript"):
        source_node = _find_child_by_field(node, "source")
        if source_node:
            source = _get_node_text(source_node, source_bytes).strip("'\"")
            name = source.split("/")[-1]
    elif language == "java":
        for child in node.children:
            if child.type == "scoped_identifier":
                name = _get_node_text(child, source_bytes)
                source = name
    elif language == "go":
        for child in node.children:
            if child.type == "import_spec_list":
                for spec in child.children:
                    if spec.type == "import_spec":
                        path_node = _find_child_by_field(spec, "path")
                        if path_node:
                            source = _get_node_text(path_node, source_bytes).strip('"')
                            name = source.split("/")[-1]
            elif child.type == "import_spec":
                path_node = _find_child_by_field(child, "path")
                if path_node:
                    source = _get_node_text(path_node, source_bytes).strip('"')
                    name = source.split("/")[-1]
    else:
        # Generic: just use the text
        name = text.split()[-1].strip("'\";<>")
        source = name

    return name, source


def _is_external_import(source: str, language: str, project_path: str) -> bool:
    """Determine if an import is external (third-party) or internal."""
    if not source:
        return False
    if language in ("python",):
        # Relative imports are internal
        if source.startswith("."):
            return False
        # Check if module corresponds to a project file
        parts = source.split(".")
        potential = Path(project_path) / "/".join(parts)
        if potential.with_suffix(".py").exists() or potential.is_dir():
            return False
        return True
    elif language in ("javascript", "typescript"):
        return not source.startswith(".") and not source.startswith("/")
    elif language == "go":
        return "/" in source  # Go external packages typically have domain paths
    return False


def parse_file(file_path: str, project_path: str, language: str | None = None) -> FileParseResult:
    """Parse a single source file and extract code structures."""
    if language is None:
        language = get_language(file_path)
    if language is None:
        return FileParseResult(file_path=file_path, language="unknown", errors=["Unsupported file type"])

    config = LANGUAGE_CONFIGS.get(language)
    if config is None:
        return FileParseResult(file_path=file_path, language=language, errors=[f"No config for {language}"])

    result = FileParseResult(file_path=file_path, language=language)

    try:
        source = Path(file_path).read_bytes()
    except (OSError, IOError) as e:
        result.errors.append(f"Cannot read file: {e}")
        return result

    try:
        parser = get_parser(language)
        tree = parser.parse(source)
    except Exception as e:
        result.errors.append(f"Parse error: {e}")
        return result

    root = tree.root_node
    source_bytes = source
    rel_path = str(Path(file_path).relative_to(project_path))

    # Track class context for methods
    current_class = None

    def walk(node, class_context=None):
        nonlocal current_class
        node_type = node.type

        # Classes
        if node_type in config["class_types"]:
            name = _extract_name(node, source_bytes, config)
            code = _get_node_text(node, source_bytes)
            superclasses = _extract_superclasses(node, source_bytes, config)

            # Find methods within class
            methods = []
            for fn_type in config["function_types"]:
                for fn_node in _find_children_by_type(node, fn_type):
                    fn_name = _extract_name(fn_node, source_bytes, config)
                    methods.append(fn_name)

            parsed_class = ParsedClass(
                name=name,
                file_path=rel_path,
                language=language,
                line_start=node.start_point[0] + 1,
                line_end=node.end_point[0] + 1,
                code=code,
                code_hash=hash_code(code),
                methods=methods,
                superclasses=superclasses,
            )
            result.classes.append(parsed_class)

            # Parse children with class context
            for child in node.children:
                walk(child, class_context=name)
            return

        # Functions / Methods
        if node_type in config["function_types"]:
            name = _extract_name(node, source_bytes, config)
            code = _get_node_text(node, source_bytes)
            params = _extract_params(node, source_bytes, config)
            calls = _extract_calls(node, source_bytes, config["call_types"])

            result.functions.append(ParsedFunction(
                name=name,
                file_path=rel_path,
                language=language,
                line_start=node.start_point[0] + 1,
                line_end=node.end_point[0] + 1,
                code=code,
                code_hash=hash_code(code),
                params=params,
                calls=calls,
                parent_class=class_context,
            ))
            return  # Don't recurse into function bodies for nested functions

        # Imports
        if node_type in config["import_types"]:
            code = _get_node_text(node, source_bytes)
            name, source_mod = _extract_import_source(node, source_bytes, language)
            is_external = _is_external_import(source_mod, language, project_path)

            # For Ruby, only count require/require_relative calls as imports
            if language == "ruby" and node_type == "call":
                func_text = ""
                if node.children:
                    func_text = _get_node_text(node.children[0], source_bytes)
                if func_text not in ("require", "require_relative"):
                    for child in node.children:
                        walk(child, class_context)
                    return

            result.imports.append(ParsedImport(
                name=name,
                file_path=rel_path,
                language=language,
                line_start=node.start_point[0] + 1,
                line_end=node.end_point[0] + 1,
                code=code,
                source=source_mod,
                is_external=is_external,
            ))
            return

        # Module-level variables (only at top level or class level, not inside functions)
        if node_type in config["variable_types"] and class_context is None:
            # Check if this is at module level (parent is module/program)
            parent_type = node.parent.type if node.parent else ""
            if parent_type in ("module", "program", "source_file", "translation_unit",
                               "compilation_unit", "class_body", "block"):
                code = _get_node_text(node, source_bytes)
                # Extract variable name
                name = "<unknown>"
                left = _find_child_by_field(node, "left") or _find_child_by_field(node, "name")
                if left:
                    name = _get_node_text(left, source_bytes)
                elif node.children:
                    for child in node.children:
                        if child.type in ("identifier", "variable_name"):
                            name = _get_node_text(child, source_bytes)
                            break

                result.variables.append(ParsedVariable(
                    name=name,
                    file_path=rel_path,
                    language=language,
                    line_start=node.start_point[0] + 1,
                    line_end=node.end_point[0] + 1,
                    code=code,
                    code_hash=hash_code(code),
                    scope="module",
                ))

        # Recurse into children
        for child in node.children:
            walk(child, class_context)

    try:
        walk(root)
    except Exception as e:
        result.errors.append(f"Walk error: {e}")

    return result
