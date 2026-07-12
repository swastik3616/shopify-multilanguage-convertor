from datetime import datetime
from database import execute


# ── tiny helpers ──────────────────────────────────────────────────────────────

def _now():
    return datetime.utcnow()

def _row_to(cls, row):
    if row is None:
        return None
    obj = cls.__new__(cls)
    for k, v in row.items():
        setattr(obj, k.lower(), v)
    # Normalise column names that differ between raw SQL and ORM field names
    if not hasattr(obj, "id") and hasattr(obj, "ID"):
        obj.id = obj.ID
    return obj


# ── QueryProxy ────────────────────────────────────────────────────────────────

class QueryProxy:

    def __init__(self, cls):
        self._cls    = cls
        self._table  = cls.__tablename__.upper()
        self._wheres = []   # list of (sql_fragment, value_or_None)
        self._order  = None
        self._lim    = None

    # ── filtering ─────────────────────────────────────────────────────────────

    def filter_by(self, **kwargs):
        qp = self._clone()
        for col, val in kwargs.items():
            if val is None:
                qp._wheres.append((f'"{col.upper()}" IS NULL', None))
            else:
                qp._wheres.append((f'"{col.upper()}" = %s', val))
        return qp

    def filter(self, *exprs):
        qp = self._clone()
        for expr in exprs:
            qp._wheres.append((expr.sql, expr.val))
        return qp

    def order_by(self, *cols):
        qp = self._clone()
        parts = []
        for c in cols:
            if isinstance(c, str):
                parts.append(c)
            elif isinstance(c, _OrderExpr):
                parts.append(str(c))
            else:
                parts.append(str(c))
        qp._order = ", ".join(parts)
        return qp

    def limit(self, n):
        qp = self._clone()
        qp._lim = n
        return qp

    # ── terminal ops ──────────────────────────────────────────────────────────

    def _build_where(self):
        parts, vals = [], []
        for sql_frag, val in self._wheres:
            parts.append(sql_frag)
            if val is not None:
                vals.append(val)
        where = ("WHERE " + " AND ".join(parts)) if parts else ""
        return where, vals

    def _build_select(self):
        where, vals = self._build_where()
        sql = f"SELECT * FROM {self._table} {where}"
        if self._order:
            sql += f" ORDER BY {self._order}"
        if self._lim:
            sql += f" LIMIT {self._lim}"
        return sql, vals

    def all(self):
        sql, vals = self._build_select()
        rows = execute(sql, vals, fetch="all") or []
        return [_row_to(self._cls, r) for r in rows]

    def first(self):
        qp = self._clone()
        if qp._lim is None:
            qp._lim = 1
        sql, vals = qp._build_select()
        row = execute(sql, vals, fetch="one")
        return _row_to(self._cls, row)

    def count(self):
        where, vals = self._build_where()
        sql = f"SELECT COUNT(*) AS CNT FROM {self._table} {where}"
        row = execute(sql, vals, fetch="one")
        return row["CNT"] if row else 0

    def get(self, pk):
        return self.filter_by(id=pk).first()

    def delete(self):
        where, vals = self._build_where()
        sql = f"DELETE FROM {self._table} {where}"
        execute(sql, vals)
        return 0     # deleted count (approximate)

    def in_(self, col, values):
        """Usage: Model.query.in_('col', [...])"""
        if not values:
            return self
        placeholders = ", ".join(["%s"] * len(values))
        qp = self._clone()
        qp._wheres.append((f'"{col.upper()}" IN ({placeholders})', None))
        # inject multiple values
        qp._wheres[-1] = (f'"{col.upper()}" IN ({placeholders})', values)
        return qp

    # ── misc ──────────────────────────────────────────────────────────────────

    def distinct(self):
        return self

    def group_by(self, *cols):
        return self   # handled inline in dashboard_routes via raw execute

    def _clone(self):
        qp = QueryProxy(self._cls)
        qp._wheres = list(self._wheres)
        qp._order  = self._order
        qp._lim    = self._lim
        return qp


# ── Expression helpers (produced by Column descriptors) ───────────────────────

class _Expr:
    def __init__(self, sql, val=None):
        self.sql = sql
        self.val = val

    def is_(self, v):
        if v is None or v is False:
            return _Expr(self.sql.replace("= %s", "IS NULL") if "= %s" in self.sql else self.sql + " IS NULL")
        if v is True:
            return _Expr(self.sql.replace("= %s", "IS NOT NULL") if "= %s" in self.sql else self.sql + " IS NOT NULL")
        return _Expr(self.sql, v)

    def isnot(self, v):
        if v is None:
            col = self.sql   # the column name fragment
            return _Expr(f"{col} IS NOT NULL")
        return _Expr(self.sql, v)

    def in_(self, values):
        col = self.sql  # should just be the column name fragment at this point
        placeholders = ", ".join(["%s"] * len(values))
        return _Expr(f"{col} IN ({placeholders})", values)


class _OrderExpr:
    def __init__(self, col, direction="ASC"):
        self.col = col
        self.direction = direction

    def __str__(self):
        return f'"{self.col.upper()}" {self.direction}'

    def asc(self):
        return _OrderExpr(self.col, "ASC")

    def desc(self):
        return _OrderExpr(self.col, "DESC")


class Column:
    """Descriptor that produces _Expr objects for filter() calls."""
    def __init__(self, col_name):
        self.col_name = col_name.upper()

    def __get__(self, obj, objtype=None):
        if obj is None:
            return _ColRef(self.col_name)
        return getattr(obj, self.col_name.lower(), None)

    def __set__(self, obj, value):
        setattr(obj, f"_{self.col_name.lower()}_val", value)


class _ColRef:
    """Returned when accessing Model.column (class-level) for filter expressions."""
    def __init__(self, col_name):
        self.col_name = col_name

    def __eq__(self, other):
        return _Expr(f'"{self.col_name}" = %s', other)

    def in_(self, values):
        placeholders = ", ".join(["%s"] * len(values))
        return _Expr(f'"{self.col_name}" IN ({placeholders})', values)

    def is_(self, val):
        if val is None:
            return _Expr(f'"{self.col_name}" IS NULL')
        return _Expr(f'"{self.col_name}" IS NOT NULL')

    def isnot(self, val):
        if val is None:
            return _Expr(f'"{self.col_name}" IS NOT NULL')
        return _Expr(f'"{self.col_name}" = %s', val)

    def asc(self):
        return _OrderExpr(self.col_name, "ASC")

    def desc(self):
        return _OrderExpr(self.col_name, "DESC")

    def __str__(self):
        return f'"{self.col_name}"'

    def __ge__(self, other):
        return _Expr(f'"{self.col_name}" >= %s', other)


# ── Base model ────────────────────────────────────────────────────────────────

class _ModelMeta(type):
    def __init__(cls, name, bases, namespace):
        super().__init__(name, bases, namespace)
        if hasattr(cls, "__tablename__"):
            cls.query = QueryProxy(cls)


class Model(metaclass=_ModelMeta):
    pass


# ═════════════════════════════════════════════════════════════════════════════
# Concrete Models
# ═════════════════════════════════════════════════════════════════════════════

class Translation(Model):
    __tablename__ = "translations"

    id              = None
    source_text     = None
    target_language = None
    translated_text = None
    created_at      = None

    # Class-level col refs for filter()
    id              = _ColRef("ID")
    source_text     = _ColRef("SOURCE_TEXT")
    target_language = _ColRef("TARGET_LANGUAGE")
    translated_text = _ColRef("TRANSLATED_TEXT")
    created_at      = _ColRef("CREATED_AT")

    def __init__(self, source_text, target_language, translated_text):
        self._id              = None
        self._source_text     = source_text
        self._target_language = target_language
        self._translated_text = translated_text
        self._created_at      = _now()

    # Make instance attribute access work after __init__
    def __getattr__(self, name):
        priv = f"_{name}"
        if priv in self.__dict__:
            return self.__dict__[priv]
        raise AttributeError(name)

    def _save(self):
        if self._id is None:
            row = execute(
                "INSERT INTO TRANSLATIONS (SOURCE_TEXT, TARGET_LANGUAGE, TRANSLATED_TEXT, CREATED_AT) "
                "VALUES (%s, %s, %s, %s)",
                (self._source_text, self._target_language, self._translated_text, self._created_at),
            )
        else:
            execute(
                "UPDATE TRANSLATIONS SET TRANSLATED_TEXT=%s WHERE ID=%s",
                (self._translated_text, self._id),
            )

    def _delete(self):
        execute("DELETE FROM TRANSLATIONS WHERE ID=%s", (self._id,))


class PageContent(Model):
    __tablename__ = "page_contents"

    id          = _ColRef("ID")
    page        = _ColRef("PAGE")
    key         = _ColRef("KEY")
    source_text = _ColRef("SOURCE_TEXT")
    html_tag    = _ColRef("HTML_TAG")
    section_id  = _ColRef("SECTION_ID")
    resource_id = _ColRef("RESOURCE_ID")

    def __init__(self, page, key, source_text, html_tag=None, section_id=None, resource_id=None):
        self._id          = None
        self._page        = page
        self._key         = key
        self._source_text = source_text
        self._html_tag    = html_tag
        self._section_id  = section_id
        self._resource_id = resource_id

    def __getattr__(self, name):
        priv = f"_{name}"
        if priv in self.__dict__:
            return self.__dict__[priv]
        raise AttributeError(name)

    def _save(self):
        if self._id is None:
            try:
                execute(
                    "INSERT INTO PAGE_CONTENTS (PAGE, KEY, SOURCE_TEXT, HTML_TAG, SECTION_ID, RESOURCE_ID) "
                    "VALUES (%s, %s, %s, %s, %s, %s)",
                    (self._page, self._key, self._source_text, self._html_tag,
                     self._section_id, self._resource_id),
                )
            except Exception:
                execute(
                    "UPDATE PAGE_CONTENTS SET SOURCE_TEXT=%s, HTML_TAG=%s, SECTION_ID=%s, RESOURCE_ID=%s "
                    "WHERE PAGE=%s AND KEY=%s",
                    (self._source_text, self._html_tag, self._section_id,
                     self._resource_id, self._page, self._key),
                )
        else:
            execute(
                "UPDATE PAGE_CONTENTS SET SOURCE_TEXT=%s, HTML_TAG=%s, SECTION_ID=%s, RESOURCE_ID=%s "
                "WHERE ID=%s",
                (self._source_text, self._html_tag, self._section_id,
                 self._resource_id, self._id),
            )

    def _delete(self):
        execute("DELETE FROM PAGE_CONTENTS WHERE ID=%s", (self._id,))


class AuditLog(Model):
    __tablename__ = "audit_logs"

    id         = _ColRef("ID")
    action     = _ColRef("ACTION")
    created_at = _ColRef("CREATED_AT")

    def __init__(self, action):
        self._id         = None
        self._action     = action
        self._created_at = _now()

    def __getattr__(self, name):
        priv = f"_{name}"
        if priv in self.__dict__:
            return self.__dict__[priv]
        raise AttributeError(name)

    def _save(self):
        execute(
            "INSERT INTO AUDIT_LOGS (ACTION, CREATED_AT) VALUES (%s, %s)",
            (self._action, self._created_at),
        )

    def _delete(self):
        execute("DELETE FROM AUDIT_LOGS WHERE ID=%s", (self._id,))


class ShopifyStore(Model):
    __tablename__ = "shopify_stores"

    id           = _ColRef("ID")
    shop         = _ColRef("SHOP")
    access_token = _ColRef("ACCESS_TOKEN")

    def __init__(self, shop, access_token):
        self._id           = None
        self._shop         = shop
        self._access_token = access_token

    def __getattr__(self, name):
        priv = f"_{name}"
        if priv in self.__dict__:
            return self.__dict__[priv]
        raise AttributeError(name)

    def _save(self):
        if self._id is None:
            try:
                execute(
                    "INSERT INTO SHOPIFY_STORES (SHOP, ACCESS_TOKEN) VALUES (%s, %s)",
                    (self._shop, self._access_token),
                )
            except Exception:
                execute(
                    "UPDATE SHOPIFY_STORES SET ACCESS_TOKEN=%s WHERE SHOP=%s",
                    (self._access_token, self._shop),
                )
        else:
            execute(
                "UPDATE SHOPIFY_STORES SET ACCESS_TOKEN=%s WHERE ID=%s",
                (self._access_token, self._id),
            )

    def _delete(self):
        execute("DELETE FROM SHOPIFY_STORES WHERE ID=%s", (self._id,))


class AppSetting(Model):
    __tablename__ = "app_settings"

    id    = _ColRef("ID")
    key   = _ColRef("KEY")
    value = _ColRef("VALUE")

    def __init__(self, key, value):
        self._id    = None
        self._key   = key
        self._value = value

    def __getattr__(self, name):
        priv = f"_{name}"
        if priv in self.__dict__:
            return self.__dict__[priv]
        raise AttributeError(name)

    def _save(self):
        if self._id is None:
            try:
                execute(
                    "INSERT INTO APP_SETTINGS (KEY, VALUE) VALUES (%s, %s)",
                    (self._key, self._value),
                )
            except Exception:
                execute(
                    "UPDATE APP_SETTINGS SET VALUE=%s WHERE KEY=%s",
                    (self._value, self._key),
                )
        else:
            execute(
                "UPDATE APP_SETTINGS SET VALUE=%s WHERE ID=%s",
                (self._value, self._id),
            )

    def _delete(self):
        execute("DELETE FROM APP_SETTINGS WHERE ID=%s", (self._id,))


class OverlayEdit(Model):
    __tablename__ = "overlay_edits"

    id             = _ColRef("ID")
    url            = _ColRef("URL")
    original_text  = _ColRef("ORIGINAL_TEXT")
    new_text       = _ColRef("NEW_TEXT")
    is_translation = _ColRef("IS_TRANSLATION")
    target_language= _ColRef("TARGET_LANGUAGE")
    selector       = _ColRef("SELECTOR")
    element_tag    = _ColRef("ELEMENT_TAG")
    field_name     = _ColRef("FIELD_NAME")

    def __init__(self, url, original_text, new_text, is_translation=False,
                 target_language=None, selector=None, element_tag=None, field_name=None):
        self._id             = None
        self._url            = url
        self._original_text  = original_text
        self._new_text       = new_text
        self._is_translation = is_translation
        self._target_language= target_language
        self._selector       = selector
        self._element_tag    = element_tag
        self._field_name     = field_name

    def __getattr__(self, name):
        priv = f"_{name}"
        if priv in self.__dict__:
            return self.__dict__[priv]
        raise AttributeError(name)

    def _save(self):
        if self._id is None:
            execute(
                "INSERT INTO OVERLAY_EDITS "
                "(URL, ORIGINAL_TEXT, NEW_TEXT, IS_TRANSLATION, TARGET_LANGUAGE, SELECTOR, ELEMENT_TAG, FIELD_NAME) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (self._url, self._original_text, self._new_text, self._is_translation,
                 self._target_language, self._selector, self._element_tag, self._field_name),
            )
        else:
            execute(
                "UPDATE OVERLAY_EDITS SET NEW_TEXT=%s, SELECTOR=%s, ELEMENT_TAG=%s, FIELD_NAME=%s "
                "WHERE ID=%s",
                (self._new_text, self._selector, self._element_tag, self._field_name, self._id),
            )

    def _delete(self):
        execute("DELETE FROM OVERLAY_EDITS WHERE ID=%s", (self._id,))


class Language(Model):
    __tablename__ = "languages"

    id     = _ColRef("ID")
    name   = _ColRef("NAME")
    code   = _ColRef("CODE")
    status = _ColRef("STATUS")

    def __init__(self, name, code, status="None"):
        self._id     = None
        self._name   = name
        self._code   = code
        self._status = status

    def __getattr__(self, name):
        priv = f"_{name}"
        if priv in self.__dict__:
            return self.__dict__[priv]
        raise AttributeError(name)

    def _save(self):
        obj_id = self.__dict__.get("id", self.__dict__.get("_id"))
        status = self.__dict__.get("status", self.__dict__.get("_status"))
        name = self.__dict__.get("name", self.__dict__.get("_name"))
        code = self.__dict__.get("code", self.__dict__.get("_code"))
        
        if obj_id is None:
            execute(
                "INSERT INTO LANGUAGES (NAME, CODE, STATUS) VALUES (%s, %s, %s)",
                (name, code, status),
            )
        else:
            execute(
                "UPDATE LANGUAGES SET STATUS=%s WHERE ID=%s",
                (status, obj_id),
            )

    def _delete(self):
        execute("DELETE FROM LANGUAGES WHERE ID=%s", (self._id,))