"""LAB-3634 scratch production module: assert used for input validation MUST be flagged high."""


def set_quantity(order, quantity):
    assert quantity > 0, "quantity must be positive"
    order["quantity"] = quantity
    return order
