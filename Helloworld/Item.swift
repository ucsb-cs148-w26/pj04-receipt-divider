//
//  Item.swift
//  Helloworld
//
//  Created by Fyiii on 1/14/26.
//

import Foundation
import SwiftData

@Model
final class Item {
    var timestamp: Date
    
    init(timestamp: Date) {
        self.timestamp = timestamp
    }
}
